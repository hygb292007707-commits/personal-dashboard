import os
import yfinance as yf
from supabase import create_client
from dotenv import load_dotenv

load_dotenv() # .env dosyasını okur

# API Bilgilerini değişkene aktar
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase = create_client(url, key)

def update_market():
    # Çekilecek hisseler
    tickers = ["JEPI", "JEPQ", "AAPL", "MSFT"]
    
    for symbol in tickers:
        asset = yf.Ticker(symbol)
        info = asset.info
        
        data = {
            "symbol": symbol,
            "name": info.get("shortName"),
            "current_price": info.get("currentPrice") or info.get("navPrice") or info.get("regularMarketPrice") or 0,
            "dividend_yield": (info.get("dividendYield", 0) or 0),
            "pe_ratio": info.get("trailingPE")
        }
        
        # Tabloya yaz (Varsa güncelle, yoksa ekle)
        supabase.table("market_assets").upsert(data, on_conflict="symbol").execute()
        print(f"{symbol} güncellendi.")

if __name__ == "__main__":
    update_market()