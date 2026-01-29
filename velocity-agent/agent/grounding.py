"""
Verified Grounding Logic
Validates extracted data and communicates with Node.js backend
Implements the "no hallucination" policy
"""
import httpx
from typing import List, Dict
from datetime import datetime

from agent.models import VerifiedPrice, VerifiedSentiment, ProductData, AgentThought
from config import config


class GroundingValidator:
    """Validates and grounds data with mandatory source verification"""
    
    def __init__(self):
        self.backend_url = config.NODE_BACKEND_URL
        self.thoughts: List[AgentThought] = []
    
    def log_thought(self, thought: str, action: str, status: str):
        """Log agent's reasoning for transparency"""
        agent_thought = AgentThought(
            thought=thought,
            action=action,
            status=status
        )
        self.thoughts.append(agent_thought)
        print(f"[AGENT] {thought} | Action: {action} | Status: {status}")
    
    async def process_scraped_data(self, scraped_items: List[Dict]) -> Dict:
        """
        Process scraped data with verified grounding.
        Each data point must have a source URL or it will be rejected.
        """
        results = {
            'products_created': 0,
            'prices_added': 0,
            'sentiments_added': 0,
            'errors': []
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            for item in scraped_items:
                try:
                    self.log_thought(
                        f"Processing product: {item.get('name', 'Unknown')}",
                        "Data Validation",
                        "running"
                    )
                    
                    # Step 1: Create or find product
                    product_id = await self._create_product(client, item)
                    
                    if not product_id:
                        self.log_thought(
                            f"Failed to create product: {item.get('name')}",
                            "Product Creation",
                            "error"
                        )
                        results['errors'].append(f"Failed to create product: {item.get('name')}")
                        continue
                    
                    results['products_created'] += 1
                    
                    # Step 2: Add price with verified source
                    if 'price' in item and 'source_url' in item:
                        try:
                            verified_price = VerifiedPrice(
                                product_id=product_id,
                                price=item['price'],
                                currency=item.get('currency', 'USD'),
                                source_url=item['source_url']
                            )
                            
                            success = await self._save_price(client, product_id, verified_price)
                            if success:
                                results['prices_added'] += 1
                                self.log_thought(
                                    f"[OK] Verified price: ${item['price']} from {item['source_url']}",
                                    "Price Verification",
                                    "success"
                                )
                        except Exception as e:
                            error_msg = f"Price validation failed: {str(e)}"
                            results['errors'].append(error_msg)
                            self.log_thought(error_msg, "Price Validation", "error")
                    
                    # Step 3: Add sentiment with verified source
                    if 'sentiment_score' in item and 'sentiment_source_url' in item:
                        try:
                            verified_sentiment = VerifiedSentiment(
                                product_id=product_id,
                                sentiment_score=item['sentiment_score'],
                                sentiment_text=item.get('sentiment_text', ''),
                                source_url=item['sentiment_source_url']
                            )
                            
                            success = await self._save_sentiment(client, verified_sentiment)
                            if success:
                                results['sentiments_added'] += 1
                                self.log_thought(
                                    f"[OK] Verified sentiment: {item['sentiment_score']} from {item['sentiment_source_url']}",
                                    "Sentiment Verification",
                                    "success"
                                )
                        except Exception as e:
                            error_msg = f"Sentiment validation failed: {str(e)}"
                            results['errors'].append(error_msg)
                            self.log_thought(error_msg, "Sentiment Validation", "error")
                
                except Exception as e:
                    error_msg = f"Error processing item: {str(e)}"
                    results['errors'].append(error_msg)
                    self.log_thought(error_msg, "Item Processing", "error")
        
        # Send agent thoughts to backend
        await self._send_agent_logs(results)
        
        return results
    
    async def _create_product(self, client: httpx.AsyncClient, item: Dict) -> int:
        """Create product in backend database"""
        try:
            product_data = {
                'name': item.get('name', 'Unknown Product'),
                'category': item.get('category'),
                'competitor': item.get('competitor'),
                'insight': item.get('insight', '')  # Business insights for decision-making
            }
            
            response = await client.post(
                f"{self.backend_url}/api/products",
                json=product_data
            )
            
            if response.status_code == 201:
                data = response.json()
                return data['data']['id']
            else:
                print(f"Failed to create product: {response.text}")
                return None
                
        except Exception as e:
            print(f"Error creating product: {e}")
            return None
    
    async def _save_price(self, client: httpx.AsyncClient, product_id: int, verified_price: VerifiedPrice) -> bool:
        """Save verified price to backend"""
        try:
            response = await client.post(
                f"{self.backend_url}/api/products/{product_id}/prices",
                json=verified_price.model_dump(mode='json')
            )
            return response.status_code == 201
        except Exception as e:
            print(f"Error saving price: {e}")
            return False
    
    async def _save_sentiment(self, client: httpx.AsyncClient, verified_sentiment: VerifiedSentiment) -> bool:
        """Save verified sentiment to backend"""
        try:
            response = await client.post(
                f"{self.backend_url}/api/sentiment",
                json=verified_sentiment.model_dump(mode='json')
            )
            return response.status_code == 201
        except Exception as e:
            print(f"Error saving sentiment: {e}")
            return False
    
    async def _send_agent_logs(self, results: Dict):
        """Send agent activity logs to backend for transparency"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                for thought in self.thoughts:
                    await client.post(
                        f"{self.backend_url}/api/agent/log",
                        json={
                            'action': thought.action,
                            'status': thought.status,
                            'details': thought.thought
                        }
                    )
                
                # Send summary log
                await client.post(
                    f"{self.backend_url}/api/agent/log",
                    json={
                        'action': 'Scraping Complete',
                        'status': 'success' if not results['errors'] else 'warning',
                        'details': f"Created {results['products_created']} products, {results['prices_added']} prices, {results['sentiments_added']} sentiments"
                    }
                )
        except Exception as e:
            print(f"Error sending agent logs: {e}")
