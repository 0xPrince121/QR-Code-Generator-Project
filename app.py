

from flask import Flask, render_template, request, jsonify, send_file
import qrcode
import os
import tempfile
from datetime import datetime
import base64
from io import BytesIO

app = Flask(__name__)
app.config['SECRET_KEY'] = 'qr-generator-secret-key'

# Create directories
os.makedirs('static/qr_codes', exist_ok=True)
os.makedirs('templates', exist_ok=True)


def phone_to_whatsapp_url(phone):
    """Convert phone number to WhatsApp click-to-chat URL"""
    # Remove + sign and spaces, keep only digits
    clean_phone = ''.join(filter(str.isdigit, phone))
    return f"wa.me/{clean_phone}"





def generate_qr_code(data, output_path, qr_type='general'):
    """Generate QR code and save to file"""
    try:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        


        # Format data based on QR type
        if qr_type == 'whatsapp':
            display_url = phone_to_whatsapp_url(data)
        elif qr_type == 'email':
            display_url = f"mailto:{data}"
        elif qr_type == 'location':
            display_url = f"geo:{data}"
        else:
            # For general URLs, use as is
            display_url = data
            
        qr.add_data(display_url)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(output_path)
        
        return True, display_url
    except Exception as e:
        return False, str(e)



@app.route('/generate_qr', methods=['POST'])
def generate_qr():
    """Generate QR code from provided data"""
    try:
        data = request.json.get('data', '').strip()
        qr_type = request.json.get('type', 'general')
        
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'})
        
        # Generate unique filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"qr_{timestamp}.png"
        output_path = os.path.join('static/qr_codes', filename)
        
        # Generate QR code
        success, result = generate_qr_code(data, output_path, qr_type)
        
        if success:
            return jsonify({
                'success': True,
                'filename': filename,
                'url': result,
                'qr_type': qr_type
            })
        else:
            return jsonify({'success': False, 'error': result})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/download/<filename>')
def download(filename):
    """Download generated QR code"""
    try:
        filepath = os.path.join('static/qr_codes', filename)
        return send_file(filepath, as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 404



if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(debug=False, host='0.0.0.0', port=port)
