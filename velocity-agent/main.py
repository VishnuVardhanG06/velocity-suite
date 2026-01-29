import os
import asyncio
import sys

# CRITICAL: Fix for Python 3.14 subprocess issues on Windows
if os.name == 'nt':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    if 'HOME' not in os.environ:
        os.environ['HOME'] = os.environ.get('USERPROFILE', '')
    print(f"DEBUG: HOME set to {os.environ.get('HOME')}")
    print("DEBUG: WindowsProactorEventLoopPolicy enforced")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from agent.models import ScrapeRequest, ScrapeResult
from agent.scraper import BrowserScraper
from agent.grounding import GroundingValidator
from config import config


# Global scraper instance
scraper = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage browser lifecycle"""
    global scraper
    scraper = BrowserScraper()
    await scraper.initialize()
    print("Browser initialized")
    yield
    await scraper.close()
    print("Browser closed")


# Create FastAPI app
app = FastAPI(
    title="Velocity Agent",
    description="AI Engine for Grounded Autonomous Intelligence",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "velocity-agent",
        "browser": "initialized" if scraper else "not initialized"
    }


@app.post("/scrape", response_model=ScrapeResult)
async def scrape_data(request: ScrapeRequest):
    """
    Main scraping endpoint.
    Autonomously browses the web, extracts data, and applies verified grounding.
    """
    if not scraper:
        raise HTTPException(status_code=503, detail="Browser not initialized")
    
    try:
        print("\n" + "="*60)
        print("VELOCITY AGENT - AUTONOMOUS SCRAPING INITIATED")
        print("="*60)
        print(f"Targets: {', '.join(request.targets)}")
        print("="*60 + "\n")
        
        all_results = []
        errors = []
        
        # Process each target
        for target in request.targets:
            try:
                print(f"\n[SCRAPING] Target: {target}")
                scraped_data = await scraper.scrape_demo_data(target)
                all_results.extend(scraped_data)
                print(f"[SCRAPING] Found {len(scraped_data)} items")
            except Exception as e:
                error_msg = f"Failed to scrape {target}: {str(e)}"
                errors.append(error_msg)
                print(f"[SCRAPING] Failed: {error_msg}")
        
        # Apply verified grounding
        print(f"\n[GROUNDING] Validating {len(all_results)} items with source verification...")
        validator = GroundingValidator()
        results = await validator.process_scraped_data(all_results)
        
        # Merge errors
        if results.get('errors'):
            errors.extend(results['errors'])
        
        print("\n" + "="*60)
        print("SCRAPING COMPLETE")
        print("="*60)
        print(f"Products: {results['products_created']}")
        print(f"Prices: {results['prices_added']} (all verified with source URLs)")
        print(f"Sentiments: {results['sentiments_added']} (all verified with source URLs)")
        if errors:
            print(f"Errors: {len(errors)}")
        print("="*60 + "\n")
        
        return ScrapeResult(
            success=True,
            message=f"Scraped and validated {results['products_created']} products",
            results=[results],
            errors=errors if errors else None
        )
    
    except Exception as e:
        print(f"\n[ERROR] {str(e)}\n")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Velocity Agent",
        "version": "1.0.0",
        "description": "Grounded Autonomous Intelligence Engine",
        "endpoints": {
            "/health": "Health check",
            "/scrape": "POST - Trigger autonomous scraping",
            "/docs": "API documentation"
        }
    }


if __name__ == "__main__":
    print("="*60)
    print("VELOCITY AGENT - AI ENGINE")
    print("="*60)
    print("")
    print("Starting autonomous intelligence engine...")
    print("")
    
    # Re-enforce policy just before starting uvicorn
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # Disable reload for stability on Python 3.14/Windows
        log_level="info",
        loop="asyncio" # Explicitly use asyncio loop
    )
