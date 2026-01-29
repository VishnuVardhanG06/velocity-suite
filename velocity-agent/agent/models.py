from pydantic import BaseModel, HttpUrl, validator, Field
from typing import Optional
from datetime import datetime

class VerifiedPrice(BaseModel):
    """
    Price data with mandatory source verification.
    This enforces the "no hallucination" policy at the schema level.
    """
    product_id: int = Field(..., description="Product ID from database")
    price: float = Field(..., gt=0, description="Price must be positive")
    currency: str = Field(default="USD", description="Currency code")
    source_url: HttpUrl = Field(..., description="REQUIRED: Live web source for this price")
    
    @validator('source_url')
    def validate_source(cls, v):
        """Ensure source URL is not None or empty"""
        if not v:
            raise ValueError('source_url is REQUIRED for verified grounding - no hallucinations allowed')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "product_id": 1,
                "price": 79.99,
                "currency": "USD",
                "source_url": "https://example.com/product/123"
            }
        }


class VerifiedSentiment(BaseModel):
    """
    Sentiment data with mandatory source verification.
    Sentiment score must be between -1.0 (very negative) and 1.0 (very positive).
    """
    product_id: int = Field(..., description="Product ID from database")
    sentiment_score: float = Field(..., ge=-1.0, le=1.0, description="Sentiment from -1.0 to 1.0")
    sentiment_text: Optional[str] = Field(None, description="Extracted review/comment text")
    raw_reviews: Optional[list[str]] = Field(default=None, description="Raw review texts extracted from page (first 3)")
    source_url: HttpUrl = Field(..., description="REQUIRED: Live web source for this sentiment")
    
    @validator('source_url')
    def validate_source(cls, v):
        """Ensure source URL is not None or empty"""
        if not v:
            raise ValueError('source_url is REQUIRED for verified grounding - no hallucinations allowed')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "product_id": 1,
                "sentiment_score": 0.8,
                "sentiment_text": "Great product, highly recommend!",
                "raw_reviews": ["Great product!", "Works perfectly", "Highly recommend"],
                "source_url": "https://example.com/reviews/456"
            }
        }


class ProductData(BaseModel):
    """Product information extracted from scraping"""
    name: str = Field(..., description="Product name")
    category: Optional[str] = Field(None, description="Product category")
    competitor: Optional[str] = Field(None, description="Competitor/brand name")


class ScrapeRequest(BaseModel):
    """Request to trigger scraping workflow"""
    targets: list[str] = Field(default=['default'], description="List of scraping targets to process")


class ScrapeResult(BaseModel):
    """Result from scraping operation"""
    success: bool
    message: str
    results: Optional[list] = None
    errors: Optional[list] = None


class AgentThought(BaseModel):
    """Agent's reasoning/thought process for transparency"""
    timestamp: datetime = Field(default_factory=datetime.now)
    thought: str = Field(..., description="What the agent is thinking/doing")
    action: str = Field(..., description="Action being taken")
    status: str = Field(..., description="Status: running, success, error")
