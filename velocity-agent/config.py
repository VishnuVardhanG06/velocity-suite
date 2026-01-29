import os
from dotenv import load_dotenv

load_dotenv()

# Configuration settings
class Config:
    # Node.js backend
    NODE_BACKEND_URL = os.getenv('NODE_BACKEND_URL', 'http://localhost:3000')
    
    # Browser settings
    HEADLESS = os.getenv('HEADLESS', 'true').lower() == 'true'
    BROWSER_TIMEOUT = int(os.getenv('BROWSER_TIMEOUT', '30000'))  # 30 seconds
    
    # Scraping targets - Demo URLs for testing
    # In production, these would be real competitor sites
    SCRAPING_TARGETS = {
        'default': {
            'name': 'Demo Product Search',
            'urls': [
                'https://example.com',  # Placeholder - will be replaced with actual logic
            ]
        },
        'electronics': {
            'name': 'Electronics Products',
            'urls': [
                'https://www.amazon.com/s?k=wireless+headphones',
            ]
        },
        'wearables': {
            'name': 'Wearable Devices',
            'urls': [
                'https://www.amazon.com/s?k=fitness+tracker',
            ]
        }
    }
    
    # User agent rotation for stealth
    USER_AGENTS = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    ]

config = Config()
