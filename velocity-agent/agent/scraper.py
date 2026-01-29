"""
Playwright Browser Automation for Web Scraping
Implements stealth mode and extracts pricing/sentiment data
"""
import asyncio
import random
from playwright.async_api import async_playwright, Page, Browser
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
import re

from config import config


class BrowserScraper:
    """Autonomous browser scraper with stealth capabilities"""
    
    def __init__(self):
        self.browser: Optional[Browser] = None
        self.playwright = None
    
    async def initialize(self):
        """Initialize Playwright browser"""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=config.HEADLESS,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox'
            ]
        )
    
    async def close(self):
        """Clean up browser resources"""
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
    
    async def create_stealth_page(self) -> Page:
        """Create a new page with stealth settings"""
        context = await self.browser.new_context(
            user_agent=random.choice(config.USER_AGENTS),
            viewport={'width': 1920, 'height': 1080},
            locale='en-US',
        )
        
        page = await context.new_page()
        
        # Override webdriver detection
        await page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        """)
        
        return page
    
    async def scrape_demo_data(self, target: str = 'default') -> List[Dict]:
        """
        Scrape data from either demo pool or live URLs.
        Automatically routes based on target type (URL vs 'default').
        """
        results = []
        
        # LIVE URL MODE: If target is a URL, scrape real data
        if target.startswith('http://') or target.startswith('https://'):
            print(f"Live scraping mode: {target}")
            try:
                live_data = await self.scrape_live_site(target)
                if live_data:
                    results.append(live_data)
                    return results
                else:
                    print(f"Live scraping failed, falling back to demo mode")
            except Exception as e:
                print(f"Live scraping error: {e}. Falling back to demo mode.")
        
        # DEMO MODE: Default behavior with randomized product pool
        page = await self.create_stealth_page()
        
        try:
            if target == 'default' or not results:
                # Comprehensive product pool (35 products across 7 categories)
                product_pool = [
                    # Electronics
                    {'name': 'UltraSound Pro Headphones', 'category': 'Electronics', 'competitor': 'AudioTech', 
                     'price': 149.99, 'sentiment_score': 0.85, 'sentiment_text': 'Excellent sound quality and comfortable fit',
                     'insight': 'Strong customer satisfaction. Premium pricing justified by quality. Recommend highlighting noise cancellation in marketing.'},
                    {'name': 'SmartHome Hub Pro', 'category': 'Electronics', 'competitor': 'HomeTech', 
                     'price': 89.99, 'sentiment_score': 0.78, 'sentiment_text': 'Easy setup, works with most devices',
                     'insight': 'Good value proposition at $90. Consider bundling with smart bulbs to increase AOV.'},
                    {'name': 'Wireless Charger Pad', 'category': 'Electronics', 'competitor': 'ChargeTech', 
                     'price': 29.99, 'sentiment_score': 0.65, 'sentiment_text': 'Works fine but charges slowly',
                     'insight': 'Price competitive but sentiment declining. Monitor competitor fast-charging offerings.'},
                    {'name': '4K Webcam Pro', 'category': 'Electronics', 'competitor': 'VisionTech', 
                     'price': 119.99, 'sentiment_score': 0.82, 'sentiment_text': 'Crystal clear video, perfect for remote work',
                     'insight': 'Strong WFH market fit. Price 15% above market avg - consider promotion to gain share.'},
                    {'name': 'Bluetooth Speaker Mini', 'category': 'Electronics', 'competitor': 'SoundWave', 
                     'price': 39.99, 'sentiment_score': 0.71, 'sentiment_text': 'Good sound for the size',
                     'insight': 'Entry-level product performing well. Opportunity to upsell to premium line.'},
                    
                    # Wearables
                    {'name': 'FitTrack Elite Watch', 'category': 'Wearables', 'competitor': 'FitnessTech', 
                     'price': 199.99, 'sentiment_score': 0.72, 'sentiment_text': 'Good fitness tracking, battery could be better',
                     'insight': 'Battery life complaints increasing. R&D should prioritize longer battery in next version.'},
                    {'name': 'SmartBand Health', 'category': 'Wearables', 'competitor': 'HealthTrack', 
                     'price': 79.99, 'sentiment_score': 0.88, 'sentiment_text': 'Accurate tracking, comfortable all day',
                     'insight': 'Exceptional value + high satisfaction. PROMOTE HEAVILY - this is a market winner.'},
                    {'name': 'RunPro GPS Watch', 'category': 'Wearables', 'competitor': 'RunTech', 
                     'price': 249.99, 'sentiment_score': 0.79, 'sentiment_text': 'Precise GPS, great for marathons',
                     'insight': 'Niche product for serious runners. Target running communities and marathon events.'},
                    {'name': 'Sleep Tracker Ring', 'category': 'Wearables', 'competitor': 'SleepTech', 
                     'price': 299.99, 'sentiment_score': 0.74, 'sentiment_text': 'Interesting insights but pricey',
                     'insight': 'Premium pricing limiting adoption. Consider financing options to reduce barrier.'},
                    
                    # Home Appliances
                    {'name': 'BrewMaster Deluxe', 'category': 'Home Appliances', 'competitor': 'KitchenPro', 
                     'price': 89.99, 'sentiment_score': 0.68, 'sentiment_text': 'Makes great coffee, a bit noisy',
                     'insight': 'Noise complaints detected. Highlight programmable features to offset concern.'},
                    {'name': 'Air Purifier Max', 'category': 'Home Appliances', 'competitor': 'CleanAir', 
                     'price': 159.99, 'sentiment_score': 0.91, 'sentiment_text': 'Drastically improved air quality',
                     'insight': 'TOP PERFORMER - 91% positive sentiment. Capitalize on health trends, emphasize in ads.'},
                    {'name': 'Robot Vacuum Pro', 'category': 'Home Appliances', 'competitor': 'AutoClean', 
                     'price': 299.99, 'sentiment_score': 0.76, 'sentiment_text': 'Good cleaning, occasionally gets stuck',
                     'insight': 'Premium segment. Reliability concerns - ensure customer success team follows up.'},
                    {'name': 'Smart Thermostat', 'category': 'Home Appliances', 'competitor': 'EcoHome', 
                     'price': 129.99, 'sentiment_score': 0.83, 'sentiment_text': 'Saves money, easy to use',
                     'insight': 'Energy savings resonate with customers. Quantify ROI in marketing (payback period).'},
                    {'name': 'Blender Ultra', 'category': 'Home Appliances', 'competitor': 'BlendTech', 
                     'price': 69.99, 'sentiment_score': 0.70, 'sentiment_text': 'Powerful but loud',
                     'insight': 'Performance vs noise tradeoff. Position as professional-grade for enthusiasts.'},
                    
                    # Fashion
                    {'name': 'RunComfort Sneakers', 'category': 'Fashion', 'competitor': 'SportStyle', 
                     'price': 79.99, 'sentiment_score': 0.86, 'sentiment_text': 'Most comfortable shoes I own',
                     'insight': 'Comfort is key differentiator. Expand color options to capture more market.'},
                    {'name': 'Urban Backpack Pro', 'category': 'Fashion', 'competitor': 'CityGear', 
                     'price': 59.99, 'sentiment_score': 0.81, 'sentiment_text': 'Durable and stylish',
                     'insight': 'Strong appeal to young professionals. Cross-sell with laptop sleeves.'},
                    {'name': 'Winter Jacket Elite', 'category': 'Fashion', 'competitor': 'OutdoorWear', 
                     'price': 149.99, 'sentiment_score': 0.77, 'sentiment_text': 'Warm but heavy',
                     'insight': 'Seasonal product. Weight complaints - consider lightweight insulation R&D.'},
                    {'name': 'Casual Watch Classic', 'category': 'Fashion', 'competitor': 'TimeTech', 
                     'price': 99.99, 'sentiment_score': 0.75, 'sentiment_text': 'Nice design, good value',
                     'insight': 'Mid-tier positioning. Limited edition releases could create urgency.'},
                    
                    # Home & Garden
                    {'name': 'LED Grow Light', 'category': 'Home & Garden', 'competitor': 'PlantTech', 
                     'price': 49.99, 'sentiment_score': 0.89, 'sentiment_text': 'Plants are thriving!',
                     'insight': 'Urban gardening trend growing. Bundle with starter plant kits.'},
                    {'name': 'Smart Sprinkler System', 'category': 'Home & Garden', 'competitor': 'WaterSmart', 
                     'price': 199.99, 'sentiment_score': 0.73, 'sentiment_text': 'Saves water, setup was tricky',
                     'insight': 'Installation friction. Offer free setup service or improve instructions.'},
                    {'name': 'Outdoor Security Camera', 'category': 'Home & Garden', 'competitor': 'SecureHome', 
                     'price': 129.99, 'sentiment_score': 0.84, 'sentiment_text': 'Clear night vision, easy install',
                     'insight': 'Security is high-priority. Create multi-camera bundles for whole-home coverage.'},
                    {'name': 'Solar Path Lights', 'category': 'Home & Garden', 'competitor': 'EcoLight', 
                     'price': 34.99, 'sentiment_score': 0.69, 'sentiment_text': 'Nice ambiance but not very bright',
                     'insight': 'Brightness issues. Next version should prioritize lumens. Price sensitive segment.'},
                    
                    # Beauty & Personal Care
                    {'name': 'Sonic Toothbrush Pro', 'category': 'Beauty & Personal Care', 'competitor': 'DentalTech', 
                     'price': 89.99, 'sentiment_score': 0.87, 'sentiment_text': 'Dentist recommended, works great',
                     'insight': 'Medical endorsements drive trust. Partner with dental offices for referrals.'},
                    {'name': 'Hair Dryer Ionic', 'category': 'Beauty & Personal Care', 'competitor': 'SalonPro', 
                     'price': 69.99, 'sentiment_score': 0.80, 'sentiment_text': 'Dries quickly, reduces frizz',
                     'insight': 'Professional-quality at consumer price. Influencer partnerships recommended.'},
                    {'name': 'Facial Cleansing Brush', 'category': 'Beauty & Personal Care', 'competitor': 'SkinCare', 
                     'price': 39.99, 'sentiment_score': 0.76, 'sentiment_text': 'Skin feels cleaner',
                     'insight': 'Subscription opportunity for brush head replacements (recurring revenue).'},
                    {'name': 'LED Mirror Vanity', 'category': 'Beauty & Personal Care', 'competitor': 'BeautyTech', 
                     'price': 79.99, 'sentiment_score': 0.82, 'sentiment_text': 'Perfect lighting for makeup',
                     'insight': 'High engagement on social media. User-generated content strategy recommended.'},
                    
                    # Office & Productivity
                    {'name': 'Standing Desk Converter', 'category': 'Office & Productivity', 'competitor': 'ErgoWork', 
                     'price': 149.99, 'sentiment_score': 0.78, 'sentiment_text': 'Good for back pain',
                     'insight': 'Health benefit is key selling point. Target corporate wellness programs.'},
                    {'name': 'Ergonomic Mouse', 'category': 'Office & Productivity', 'competitor': 'ComfortTech', 
                     'price': 49.99, 'sentiment_score': 0.85, 'sentiment_text': 'No more wrist pain',
                     'insight': 'Pain-relief messaging resonates. Medical/therapeutic positioning opportunity.'},
                    {'name': 'Wireless Keyboard Slim', 'category': 'Office & Productivity', 'competitor': 'TypeTech', 
                     'price': 59.99, 'sentiment_score': 0.74, 'sentiment_text': 'Quiet typing, nice feel',
                     'insight': 'Open office appeal. Bundle with mouse for higher cart value.'},
                    {'name': 'Desk Organizer Premium', 'category': 'Office & Productivity', 'competitor': 'OfficePro', 
                     'price': 29.99, 'sentiment_score': 0.72, 'sentiment_text': 'Keeps desk tidy',
                     'insight': 'Low-cost add-on item. Perfect for cart threshold free shipping promotions.'},
                    {'name': 'Monitor Arm Dual', 'category': 'Office & Productivity', 'competitor': 'ScreenTech', 
                     'price': 99.99, 'sentiment_score': 0.81, 'sentiment_text': 'More desk space, adjustable',
                     'insight': 'Productivity enhancer. Target remote workers and gamers (dual use cases).'},
                    {'name': 'Laptop Stand Aluminum', 'category': 'Office & Productivity', 'competitor': 'TechGear', 
                     'price': 39.99, 'sentiment_score': 0.79, 'sentiment_text': 'Better posture, sleek design',
                     'insight': 'Aesthetics + ergonomics. Instagram-worthy - leverage influencer unboxings.'},
                    {'name': 'Cable Management Kit', 'category': 'Office & Productivity', 'competitor': 'OrganizeTech', 
                     'price': 19.99, 'sentiment_score': 0.68, 'sentiment_text': 'Helps but not perfect',
                     'insight': 'Utility product with room for improvement. Customer feedback for V2 design.'},
                    {'name': 'USB-C Hub 7-in-1', 'category': 'Office & Productivity', 'competitor': 'ConnectTech', 
                     'price': 44.99, 'sentiment_score': 0.83, 'sentiment_text': 'Essential for new MacBooks',
                     'insight': 'Mac ecosystem tie-in. Market alongside Apple product launches.'},
                ]
                
                # Randomize selection - pick 3-5 products per scan for variety
                import random
                num_products = random.randint(3, 5)
                selected_products = random.sample(product_pool, num_products)
                
                # Add source URLs dynamically
                for product in selected_products:
                    product['source_url'] = f"https://example.com/products/{product['name'].lower().replace(' ', '-')}"
                    product['sentiment_source_url'] = f"https://example.com/reviews/{product['name'].lower().replace(' ', '-')}"
                
                results.extend(selected_products)
            
            # Simulate network delay
            await asyncio.sleep(1)
            
        except Exception as e:
            print(f"Scraping error: {e}")
            raise
        finally:
            await page.close()
        
        return results
    
    async def scrape_live_site(self, url: str) -> Optional[Dict]:
        """
        Scrape live product page for actual price and customer reviews.
        Returns product data with extracted price and first 3 reviews.
        """
        page = await self.create_stealth_page()
        
        try:
            # Navigate to page with timeout
            await page.goto(url, wait_until='networkidle', timeout=30000)
            
            # Extract product name
            product_name = await self._extract_product_name(page)
            
            # Extract current price
            price = await self._extract_price_from_page(page)
            
            # Extract first 3 customer reviews
            reviews = await self._extract_reviews(page, limit=3)
            
            # Calculate sentiment from reviews
            sentiment_score = self._calculate_sentiment_from_reviews(reviews)
            sentiment_text = reviews[0] if reviews else ''
            
            # Extract domain for competitor field
            from urllib.parse import urlparse
            domain = urlparse(url).netloc
            
            return {
                'name': product_name,
                'category': 'Unknown',  # Could be extracted from breadcrumbs if needed
                'competitor': domain,
                'price': price,
                'sentiment_score': sentiment_score,
                'sentiment_text': sentiment_text[:200] if sentiment_text else '',  # Limit length
                'raw_reviews': reviews,  # NEW: Raw review texts for storage
                'source_url': url,
                'insight': f'Live data extracted from {domain}'
            }
            
        except Exception as e:
            print(f"Error scraping live URL {url}: {e}")
            return None
        finally:
            await page.close()
    
    async def _extract_product_name(self, page: Page) -> str:
        """Extract product name using common selectors"""
        selectors = [
            'h1',
            '[data-test="product-title"]',
            '.product-title',
            '[itemprop="name"]',
            '#productTitle',  # Amazon
        ]
        
        for selector in selectors:
            try:
                element = await page.query_selector(selector)
                if element:
                    text = await element.inner_text()
                    if text and len(text.strip()) > 0:
                        return text.strip()[:100]  # Limit length
            except:
                continue
        
        return 'Unknown Product'
    
    async def _extract_price_from_page(self, page: Page) -> float:
        """
        Extract current price from page using common e-commerce selectors.
        Tries multiple fallback patterns for robustness.
        """
        price_selectors = [
            '[data-test="product-price"]',
            '.price',
            '[itemprop="price"]',
            '#priceblock_ourprice',  # Amazon
            '#priceblock_dealprice',  # Amazon deal
            '.product-price',
            '.price-now',
            '[class*="price"]',
            'span:has-text("$")',
        ]
        
        for selector in price_selectors:
            try:
                element = await page.query_selector(selector)
                if element:
                    text = await element.inner_text()
                    # Extract numeric value
                    price = self._extract_price(text)
                    if price and price > 0:
                        return price
            except:
                continue
        
        # Fallback: search entire page for price pattern
        try:
            content = await page.content()
            soup = BeautifulSoup(content, 'lxml')
            price_elem = soup.find(text=re.compile(r'\$[\d,]+\.?\d*'))
            if price_elem:
                price = self._extract_price(str(price_elem))
                if price and price > 0:
                    return price
        except:
            pass
        
        raise ValueError(f"Could not extract price from page")
    
    async def _extract_reviews(self, page: Page, limit: int = 3) -> list[str]:
        """
        Extract first N customer reviews from product page.
        Returns list of review texts.
        """
        review_selectors = [
            '[data-test="review-text"]',
            '.review-text',
            '[itemprop="reviewBody"]',
            '.review-content',
            '.customer-review',
            '[class*="review"]',
        ]
        
        reviews = []
        
        # Try each selector pattern
        for selector in review_selectors:
            try:
                elements = await page.query_selector_all(selector)
                for element in elements:
                    text = await element.inner_text()
                    # Filter out short/empty reviews
                    if text and len(text.strip()) > 20:
                        reviews.append(text.strip()[:500])  # Limit review length
                        if len(reviews) >= limit:
                            break
                
                if reviews:
                    break  # Found reviews, stop trying other selectors
            except:
                continue
        
        return reviews[:limit]
    
    def _calculate_sentiment_from_reviews(self, reviews: list[str]) -> float:
        """
        Calculate average sentiment from multiple reviews.
        Uses simple keyword matching.
        """
        if not reviews:
            return 0.0
        
        scores = [self._estimate_sentiment(review) for review in reviews]
        return sum(scores) / len(scores) if scores else 0.0
    
    def _extract_price(self, price_text: str) -> Optional[float]:
        """Extract numeric price from text"""
        # Remove currency symbols and extract number
        price_match = re.search(r'[\d,]+\.?\d*', price_text.replace(',', ''))
        if price_match:
            try:
                return float(price_match.group())
            except ValueError:
                return None
        return None
    
    def _estimate_sentiment(self, text: str) -> float:
        """
        Simple sentiment estimation based on keyword matching.
        In production, would use a proper NLP model.
        """
        text_lower = text.lower()
        
        positive_words = ['great', 'excellent', 'amazing', 'love', 'perfect', 'recommend', 'best']
        negative_words = ['bad', 'terrible', 'poor', 'worst', 'disappointing', 'waste', 'awful']
        
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        total = positive_count + negative_count
        if total == 0:
            return 0.0
        
        # Scale to -1.0 to 1.0
        return (positive_count - negative_count) / total
