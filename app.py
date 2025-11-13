import os
from flask import Flask, render_template, request, redirect, url_for, flash, Blueprint
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

# 数据模型
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

# 创建统一的主蓝图
main_bp = Blueprint('main', __name__)

# 首页
@main_bp.route('/')
def index():
    return render_template('index.html')

# 认证路由
@main_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        try:
            username = request.form.get('username')
            password = request.form.get('password')

            existing_user = User.query.filter_by(username=username).first()
            if existing_user:
                flash('用户名已存在')
                return render_template('register.html')

            new_user = User(username=username)
            new_user.set_password(password)

            db.session.add(new_user)
            db.session.commit()

            flash('注册成功！请登录')
            return redirect(url_for('main.login'))

        except Exception as e:
            db.session.rollback()
            flash(f'注册失败: {str(e)}')
            return render_template('register.html')

    return render_template('register.html')

@main_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        user = User.query.filter_by(username=username).first()

        if user and user.check_password(password):
            login_user(user)
            flash('登录成功！')
            return redirect(url_for('main.index'))
        else:
            flash('用户名或密码错误')

    return render_template('login.html')

@main_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('已退出登录')
    return redirect(url_for('main.index'))

@main_bp.route('/profile')
@login_required
def profile():
    return render_template('profile.html')

# 图片上传功能
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@main_bp.route('/upload', methods=['GET', 'POST'])
@login_required
def upload_image():
    if request.method == 'POST':
        if 'image' not in request.files:
            flash('请选择要上传的图片')
            return render_template('upload.html')

        file = request.files['image']

        if file.filename == '':
            flash('请选择要上传的图片')
            return render_template('upload.html')

        if file and allowed_file(file.filename):
            try:
                original_filename = secure_filename(file.filename)
                file_extension = original_filename.rsplit('.', 1)[1].lower()
                unique_filename = f"{uuid.uuid4()}.{file_extension}"

                # 上传到Azure Blob Storage
                connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
                blob_service_client = BlobServiceClient.from_connection_string(connection_string)

                original_blob_client = blob_service_client.get_blob_client(
                    container="originals",
                    blob=unique_filename
                )

                file_content = file.read()
                original_blob_client.upload_blob(file_content, overwrite=True)
                original_url = original_blob_client.url

                # 创建图片记录
                new_image = Image(
                    caption=request.form.get('caption', ''),
                    ownerUserID=current_user.userID,
                    originalURL=original_url,
                    thumbnailURL=original_url
                )

                db.session.add(new_image)
                db.session.commit()

                flash('图片上传成功！')
                return redirect(url_for('main.user_images'))

            except Exception as e:
                db.session.rollback()
                flash(f'上传失败: {str(e)}')
                return render_template('upload.html')
        else:
            flash('不支持的文件类型')
            return render_template('upload.html')

    return render_template('upload.html')

@main_bp.route('/images')
@login_required
def user_images():
    images = Image.query.filter_by(ownerUserID=current_user.userID).order_by(Image.imageID.desc()).all()
    return render_template('images.html', images=images)

@main_bp.route('/gallery')
def gallery():
    images = Image.query.order_by(Image.imageID.desc()).all()
    return render_template('gallery.html', images=images)

# 注册蓝图
app.register_blueprint(main_bp)

# 创建数据库表
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
