import os
import sys
import psycopg2
from azure.storage.blob import BlobServiceClient
from PIL import Image
import io
from dotenv import load_dotenv

# Add project path
sys.path.append('/var/www/flaskapp')

load_dotenv()

def generate_thumbnails():
    print("Starting thumbnail generation...")

    try:
        # Connect to database
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            sslmode='require'
        )

        # 修改查询条件：查找 thumbnailURL 为 NULL 或空字符串的图片
        cursor = conn.cursor()
        cursor.execute('SELECT imageid, originalurl FROM "Image Metadata" WHERE thumbnailurl IS NULL OR thumbnailurl = \'\'')
        pending_images = cursor.fetchall()

        print(f"Found {len(pending_images)} images needing thumbnail processing")

        # Connect to Azure Blob Storage
        connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)

        processed_count = 0

        for image_id, original_url in pending_images:
            try:
                print(f"Processing image ID: {image_id}")

                # Extract filename from URL
                original_filename = original_url.split('/')[-1]

                # Download original image from originals container
                original_blob_client = blob_service_client.get_blob_client(
                    container="originals",
                    blob=original_filename
                )

                # Download image data
                download_stream = original_blob_client.download_blob()
                image_data = download_stream.readall()

                # Process image with PIL
                with Image.open(io.BytesIO(image_data)) as img:
                    # Resize to 150px width, maintain aspect ratio
                    img.thumbnail((150, 150))

                    # Save as JPEG format (reduce file size)
                    output_buffer = io.BytesIO()
                    if img.mode in ('RGBA', 'LA'):
                        # Convert images with transparency to RGB
                        background = Image.new('RGB', img.size, (255, 255, 255))
                        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                        img = background

                    img.save(output_buffer, format='JPEG', quality=85)
                    output_buffer.seek(0)

                    # Upload thumbnail to thumbnails container
                    thumbnail_filename = f"thumb_{original_filename.split('.')[0]}.jpg"
                    thumbnail_blob_client = blob_service_client.get_blob_client(
                        container="thumbnails",
                        blob=thumbnail_filename
                    )

                    thumbnail_blob_client.upload_blob(output_buffer.read(), overwrite=True)
                    thumbnail_url = thumbnail_blob_client.url

                    # Update thumbnail URL in database
                    update_cursor = conn.cursor()
                    update_cursor.execute(
                        'UPDATE "Image Metadata" SET thumbnailurl = %s WHERE imageid = %s',
                        (thumbnail_url, image_id)
                    )
                    conn.commit()

                    print(f"✅ Successfully generated thumbnail: {thumbnail_filename}")
                    processed_count += 1

            except Exception as e:
                print(f"❌ Error processing image {image_id}: {str(e)}")
                conn.rollback()
                continue

        print(f"Thumbnail generation completed! Successfully processed {processed_count} images")

    except Exception as e:
        print(f"❌ Thumbnail generation failed: {str(e)}")

    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    generate_thumbnails()
