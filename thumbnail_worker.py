import os
import sys
import psycopg2
from azure.storage.blob import BlobServiceClient
from PIL import Image
import io
from dotenv import load_dotenv

# 添加项目路径
sys.path.append('/var/www/flaskapp')

load_dotenv()

def generate_thumbnails():
    print("开始生成缩略图...")
    
    try:
        # 连接数据库
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            sslmode='require'
        )
        
        # 获取需要处理缩略图的图片（thumbnailURL = originalURL 的图片）
        cursor = conn.cursor()
        cursor.execute('SELECT imageid, originalurl FROM "Image Metadata" WHERE thumbnailurl = originalurl')
        pending_images = cursor.fetchall()
        
        print(f"找到 {len(pending_images)} 个需要处理缩略图的图片")
        
        # 连接 Azure Blob Storage
        connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        
        processed_count = 0
        
        for image_id, original_url in pending_images:
            try:
                print(f"处理图片 ID: {image_id}")
                
                # 从URL中提取文件名
                original_filename = original_url.split('/')[-1]
                
                # 从 originals 容器下载原图
                original_blob_client = blob_service_client.get_blob_client(
                    container="originals",
                    blob=original_filename
                )
                
                # 下载图片数据
                download_stream = original_blob_client.download_blob()
                image_data = download_stream.readall()
                
                # 使用PIL处理图片
                with Image.open(io.BytesIO(image_data)) as img:
                    # 调整大小为150像素宽度，保持宽高比
                    img.thumbnail((150, 150))
                    
                    # 保存为JPEG格式（减少文件大小）
                    output_buffer = io.BytesIO()
                    if img.mode in ('RGBA', 'LA'):
                        # 如果图片有透明通道，转换为RGB
                        background = Image.new('RGB', img.size, (255, 255, 255))
                        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                        img = background
                    
                    img.save(output_buffer, format='JPEG', quality=85)
                    output_buffer.seek(0)
                    
                    # 上传缩略图到 thumbnails 容器
                    thumbnail_filename = f"thumb_{original_filename.split('.')[0]}.jpg"
                    thumbnail_blob_client = blob_service_client.get_blob_client(
                        container="thumbnails",
                        blob=thumbnail_filename
                    )
                    
                    thumbnail_blob_client.upload_blob(output_buffer.read(), overwrite=True)
                    thumbnail_url = thumbnail_blob_client.url
                    
                    # 更新数据库中的缩略图URL
                    update_cursor = conn.cursor()
                    update_cursor.execute(
                        'UPDATE "Image Metadata" SET thumbnailurl = %s WHERE imageid = %s',
                        (thumbnail_url, image_id)
                    )
                    conn.commit()
                    
                    print(f"✅ 成功生成缩略图: {thumbnail_filename}")
                    processed_count += 1
                    
            except Exception as e:
                print(f"❌ 处理图片 {image_id} 时出错: {str(e)}")
                conn.rollback()
                continue
        
        print(f"缩略图生成完成！成功处理 {processed_count} 个图片")
        
    except Exception as e:
        print(f"❌ 缩略图生成失败: {str(e)}")
    
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    generate_thumbnails()
