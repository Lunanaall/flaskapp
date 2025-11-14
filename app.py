import os
from flask import Flask, render_template, request, redirect, url_for, flash, Blueprint, jsonify
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from azure.storage.blob import BlobServiceClient
from werkzeug.utils import secure_filename
import uuid

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'dev-key-change-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'main.login'

# data model
class User(UserMixin, db.Model):
    __tablename__ = 'User Data'
    userID = db.Column('userid', db.Integer, primary_key=True)
    username = db.Column('username', db.String(80), unique=True, nullable=False)
    hashed_password = db.Column('hashed_password', db.String(255), nullable=False)

    def get_id(self):
        return str(self.userID)

    def set_password(self, password):
        self.hashed_password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.hashed_password, password)

class Image(db.Model):
    __tablename__ = 'Image Metadata'
    imageID = db.Column('imageid', db.Integer, primary_key=True)
    caption = db.Column('caption', db.Text)
    ownerUserID = db.Column('owneruserid', db.Integer, db.ForeignKey('User Data.userid'))
    originalURL = db.Column('originalurl', db.String(500))
    thumbnailURL = db.Column('thumbnailurl', db.String(500))

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# create unit blueprint
main_bp = Blueprint('main', __name__)

# index route
@main_bp.route('/')
def index():
    # get all images showing in indnex.html
    images = Image.query.order_by(Image.imageID.desc()).all()
    return render_template('index.html', images=images)

# register route
@main_bp.route('/register', methods=['POST'])
def register():
    if request.method == 'POST':
        try:
            username = request.form.get('username')
            password = request.form.get('password')

            if not username or not password:
                return jsonify({'success': False, 'message': 'Username and password are required'})

            existing_user = User.query.filter_by(username=username).first()
            if existing_user:
                return jsonify({'success': False, 'message': 'Username already exists'})

            new_user = User(username=username)
            new_user.set_password(password)

            db.session.add(new_user)
            db.session.commit()

            
            login_user(new_user)
            return jsonify({'success': True, 'message': 'Registration successful!', 'redirect': url_for('main.user_images')})

        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': f'Registration failed: {str(e)}'})

# login route
@main_bp.route('/login', methods=['POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        if not username or not password:
            return jsonify({'success': False, 'message': 'Username and password are required'})

        user = User.query.filter_by(username=username).first()

        if user and user.check_password(password):
            login_user(user)
            return jsonify({'success': True, 'message': 'Login successful!', 'redirect': url_for('main.user_images')})
        else:
            return jsonify({'success': False, 'message': 'Invalid username or password'})

# logout route
@main_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Good Bye')
    return redirect(url_for('main.index'))

# upload route
@main_bp.route('/upload', methods=['POST'])
@login_required
def upload_image():
    if request.method == 'POST':
        if 'image' not in request.files:
            flash('Choose Image')
            return redirect(url_for('main.index'))

        file = request.files['image']

        if file.filename == '':
            flash('Choose Image')
            return redirect(url_for('main.index'))

        if file and allowed_file(file.filename):
            try:
                original_filename = secure_filename(file.filename)
                file_extension = original_filename.rsplit('.', 1)[1].lower()
                unique_filename = f"{uuid.uuid4()}.{file_extension}"

                # upload to Azure Blob Storage
                connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
                blob_service_client = BlobServiceClient.from_connection_string(connection_string)

                original_blob_client = blob_service_client.get_blob_client(
                    container="originals",
                    blob=unique_filename
                )

                file_content = file.read()
                original_blob_client.upload_blob(file_content, overwrite=True)
                original_url = original_blob_client.url

                # create image record
                new_image = Image(
                    caption=request.form.get('caption', ''),
                    ownerUserID=current_user.userID,
                    originalURL=original_url,
                    thumbnailURL=None
                )

                db.session.add(new_image)
                db.session.commit()

                flash('Upload Successfully!')
                return redirect(url_for('main.user_images'))

            except Exception as e:
                db.session.rollback()
                flash(f'Upload Failure: {str(e)}')
                return redirect(url_for('main.index'))
        else:
            flash('Unsupported image format')
            return redirect(url_for('main.index'))

# images route - 
@main_bp.route('/images')
def user_images():
    
    if not current_user.is_authenticated:
        flash('Please login to view your images')
        return redirect(url_for('main.index'))
    
    images = Image.query.filter_by(ownerUserID=current_user.userID).order_by(Image.imageID.desc()).all()
    return render_template('images.html', images=images)

# gallery route
@main_bp.route('/gallery')
def gallery():
    images = Image.query.order_by(Image.imageID.desc()).all()
    return render_template('gallery.html', images=images)


@main_bp.route('/api/check-auth')
def check_auth():
    return jsonify({
        'authenticated': current_user.is_authenticated,
        'username': current_user.username if current_user.is_authenticated else None
    })

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# register blueprint
app.register_blueprint(main_bp)

# create database table
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
