import http.server
import ssl
import socket
import datetime
import ipaddress
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

HOST, PORT = '0.0.0.0', 8443


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()


def make_cert(ip):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, u"Relief Reminder Local")])
    san = x509.SubjectAlternativeName([
        x509.DNSName(u"localhost"),
        x509.IPAddress(ipaddress.ip_address(ip)),
    ])
    cert = (
        x509.CertificateBuilder()
        .subject_name(name).issuer_name(name)
        .public_key(key.public_key()).serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.utcnow())
        .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=365))
        .add_extension(san, critical=False)
        .sign(key, hashes.SHA256())
    )
    with open('cert.pem', 'wb') as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    with open('key.pem', 'wb') as f:
        f.write(key.private_bytes(serialization.Encoding.PEM,
                                  serialization.PrivateFormat.TraditionalOpenSSL,
                                  serialization.NoEncryption()))


if __name__ == '__main__':
    ip = lan_ip()
    make_cert(ip)
    print(f"LAN IP: {ip}")
    print(f"Buka di phone: https://{ip}:{PORT}")
    print("(Terima amaran sijil self-signed -> Advanced -> Proceed)")

    httpd = http.server.HTTPServer((HOST, PORT), http.server.SimpleHTTPRequestHandler)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain('cert.pem', 'key.pem')
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    httpd.serve_forever()
