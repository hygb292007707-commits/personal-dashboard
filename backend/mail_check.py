import imaplib
import email
from email.header import decode_header
import re
import os
import httpx
from dotenv import load_dotenv
from datetime import datetime
# 1. Ortam değişkenlerini yükle
load_dotenv()

GMAIL_USER = os.getenv("GMAIL_USER")
GMAIL_PASS = os.getenv("GMAIL_PASS")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def get_bank_emails():
    try:
        # 2. Gmail'e Bağlan
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(GMAIL_USER, GMAIL_PASS)
        mail.select("inbox")

        # 3. Test mailini ara (Konusunda 'Ziraat' geçenleri bulur)
        status, messages = mail.search(None, '(SUBJECT "Ziraat")')
        
        if status != "OK" or not messages[0].split():
            print("Uygun mail bulunamadı.")
            return

        for num in messages[0].split():
            status, data = mail.fetch(num, "(RFC822)")
            msg = email.message_from_bytes(data[0][1])
            
            # Mail içeriğini (metni) al
            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    if part.get_content_type() == "text/plain":
                        body = part.get_payload(decode=True).decode()
            else:
                body = msg.get_payload(decode=True).decode()

            # 4. Verileri Ayıkla (Regex)
            amount_match = re.search(r"(\d+,\d+)\s*TL", body)
            place_match = re.search(r"Harcama Yeri:\s*([^\n\r.]+)", body)

            if amount_match and place_match:
                amount = float(amount_match.group(1).replace(",", "."))
                place = place_match.group(1).strip()
                
                # 5. Veritabanına Gönderilecek Paketi Hazırla
                # Veritabanına gönderilecek paket
                row = {
                    "description": place,
                    "amount": amount,
                    "type": "expense",
                    "category": "Diger",
                    "date": datetime.now().isoformat() # Şu anki tarih ve saati ekler
                }
                
                # 6. HTTP POST İsteği ile Doğrudan Kaydet
                url = f"{SUPABASE_URL}/rest/v1/finance_transactions"
                headers = {
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                }
                
                with httpx.Client() as client:
                    response = client.post(url, json=row, headers=headers)
                    if response.status_code in [200, 201]:
                        print(f"VERİTABANINA İŞLENDİ: {place} - {amount} TL")
                    else:
                        print(f"HATA: {response.text}")

        mail.logout()
    except Exception as e:
        print(f"Sistem Hatası: {e}")

if __name__ == "__main__":
    get_bank_emails()