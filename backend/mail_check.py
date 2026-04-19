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

            # 4. Verileri Ayıkla (Regex) - ÇİFT YÖNLÜ MOTOR
            
            # Senaryo A: Harcama (Gider)
            expense_place_match = re.search(r"Harcama Yeri:\s*([^\n\r.]+)", body)
            expense_amount_match = re.search(r"(\d+,\d+)\s*TL", body)
            
            # Senaryo B: Gelen Para (Gelir) - Resmindeki formata göre
            income_match = re.search(r"hesabınıza\s+(.*?)\s+tarafından.*?\s+([\d.,]+)\s*TL\s+gönderilmiştir", body, re.IGNORECASE)

            row = None # Veritabanı paketi için boş değişken

            if expense_place_match and expense_amount_match:
                # Gider İşlemi
                amount = float(expense_amount_match.group(1).replace(",", "."))
                place = expense_place_match.group(1).strip()
                
                # Akıllı Kategori Motoru
                kategori_sozlugu = {
                    "starbucks": "Keyif/Kahve", "migros": "Market", "a101": "Market", 
                    "shell": "Ulaşım", "yemeksepeti": "Yemek", "getir": "Yemek"
                }
                category = "Diger"
                for anahtar, atanacak in kategori_sozlugu.items():
                    if anahtar in place.lower():
                        category = atanacak
                        break

                row = {
                    "description": place,
                    "amount": amount,
                    "type": "expense", # Tip: GİDER
                    "category": category,
                    "date": datetime.now().isoformat()
                }

            elif income_match:
                # Gelir İşlemi
                sender = income_match.group(1).strip() # ÖZLEM KURT kısmını yakalar
                # 1.000,00 formatını bilgisayarın anlayacağı 1000.00 formatına çevirir
                amount_str = income_match.group(2).replace(".", "").replace(",", ".")
                amount = float(amount_str)

                row = {
                    "description": f"Gelen Transfer: {sender}",
                    "amount": amount,
                    "type": "income", # Tip: GELİR
                    "category": "Gelir",
                    "date": datetime.now().isoformat()
                }

            # 5. Eğer eşleşme bulunduysa veritabanına gönder
            if row:
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
                        print(f"VERİTABANINA İŞLENDİ: {row['type'].upper()} - {row['amount']} TL")
                    else:
                        print(f"HATA: {response.text}")
            else:
                print("Mail tarandı fakat uygun bir gelir/gider formatı bulunamadı.")
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