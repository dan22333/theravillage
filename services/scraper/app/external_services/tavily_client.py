"""
Tavily API Client Service - Handles web scraping via Tavily API
"""
import asyncio
import logging
import os
from typing import List, Dict, Optional
from urllib.parse import urlparse
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from ..models.tavily import TavilyQuery, TavilyResponse, TavilyResult, TavilyResponseRecord, TavilyResultRecord
from ..db import get_db
from sqlalchemy import text

logger = logging.getLogger(__name__)

class TavilyClient:
    """Client for interacting with Tavily API"""
    
    def __init__(self, settings=None):
        # Import here to avoid circular imports
        if settings is None:
            from ..main import settings
        
        self.api_key = getattr(settings, 'TAVILY_API_KEY', None)
        self.base_url = "https://api.tavily.com"
        self.max_results = settings.TAVILY_MAX_RESULTS
        self.search_depth = settings.TAVILY_SEARCH_DEPTH
        
        if not self.api_key:
            raise ValueError("TAVILY_API_KEY is required")
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((httpx.HTTPError, httpx.TimeoutException))
    )
    async def search(self, query: TavilyQuery) -> TavilyResponse:
        """Perform search using Tavily API"""
        
        payload = {
            "api_key": self.api_key,
            "query": query.query,
            "search_depth": query.search_depth,
            "max_results": query.max_results,
            "include_answer": query.include_answer,
            "include_raw_content": query.include_raw_content,
            "include_images": True,
        }
        
        # Add domain filters if specified
        if query.include_domains:
            payload["include_domains"] = query.include_domains
        if query.exclude_domains:
            payload["exclude_domains"] = query.exclude_domains
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                logger.info(f"🔍 Searching Tavily for: {query.query}")
                
                response = await client.post(
                    f"{self.base_url}/search",
                    json=payload
                )
                response.raise_for_status()
                data = response.json()
                
                # Parse response into our models
                tavily_results = [
                    TavilyResult(
                        url=result["url"],
                        title=result.get("title"),
                        content=result["content"],
                        raw_content=result.get("raw_content"),
                        score=result["score"]
                    )
                    for result in data.get("results", [])
                ]
                
                tavily_response = TavilyResponse(
                    query=data["query"],
                    follow_up_questions=data.get("follow_up_questions"),
                    answer=data.get("answer"),
                    images=data.get("images", []),
                    results=tavily_results,
                    response_time=data["response_time"],
                    request_id=data["request_id"]
                )
                
                logger.info(f"✅ Tavily search completed: {len(tavily_results)} results in {data['response_time']:.2f}s")
                return tavily_response
                
        except httpx.HTTPError as e:
            logger.error(f"❌ Tavily API HTTP error: {e}")
            raise
        except Exception as e:
            logger.error(f"❌ Tavily API error: {e}")
            raise
    
    async def search_topic(self, topic_data: Dict, job_id: str) -> Optional[TavilyResponseRecord]:
        """Search for a specific topic and save results to database"""
        try:
            # Create search queries from topic keywords
            search_queries = self._generate_search_queries(topic_data)
            
            best_response = None
            best_score = 0
            
            # Try each search query and pick the best results
            for search_query in search_queries:
                query = TavilyQuery(
                    query=search_query,
                    search_depth=self.search_depth,
                    max_results=self.max_results,
                    include_domains=self._get_preferred_domains(),
                    exclude_domains=self._get_excluded_domains()
                )
                
                response = await self.search(query)
                
                # Calculate average score for this response
                if response.results:
                    avg_score = sum(r.score for r in response.results) / len(response.results)
                    if avg_score > best_score:
                        best_score = avg_score
                        best_response = response
                
                # Rate limiting
                await asyncio.sleep(1)  # 1 second between requests
            
            if not best_response:
                logger.warning(f"No results found for topic: {topic_data['topic_name']}")
                return None
            
            # Save to database
            return await self._save_tavily_response(best_response, topic_data, job_id, search_queries[0])
            
        except Exception as e:
            logger.error(f"❌ Error searching topic {topic_data['topic_name']}: {e}")
            return None
    
    def _generate_search_queries(self, topic_data: Dict) -> List[str]:
        """Generate search queries from topic data"""
        base_queries = []
        
        # Use provided keywords
        for keyword in topic_data.get("search_keywords", []):
            base_queries.append(keyword)
        
        # If no keywords, generate from topic name and category
        if not base_queries:
            topic_name = topic_data["topic_name"]
            category = topic_data["category"]
            
            base_queries = [
                f"{topic_name} pediatric occupational therapy",
                f"{topic_name} children occupational therapy activities",
                f"{category} {topic_name} exercises kids",
                f"pediatric OT {topic_name} treatment activities"
            ]
        
        # Limit to top 3 queries to avoid rate limiting
        return base_queries[:3]
    
    def _get_preferred_domains(self) -> List[str]:
        """Get list of preferred domains for medical/OT content"""
        return [
            "theottoolbox.com",
            "napacenter.org",
            "aota.org",  # American Occupational Therapy Association
            "ot-innovations.com",
            "pediatricot.com",
            "sensory-processing-disorder.com",
            "handwritingwithoutears.com",
            "yourtherapysource.com",
            "childdevelopmentinfo.com",
            "occupationaltherapyassistant.org",
            "sensorytools.net",
            "otplan.com"
        ]
    
    def _get_excluded_domains(self) -> List[str]:
        """Get list of domains to exclude"""
        return [
            "pinterest.com",
            "facebook.com",
            "instagram.com",
            "twitter.com",
            "tiktok.com",
            "youtube.com",  # Videos not useful for text extraction
            "amazon.com",   # Product pages
            "etsy.com",     # Product pages
        ]
    
    async def _save_tavily_response(self, response: TavilyResponse, topic_data: Dict, job_id: str, original_query: str) -> TavilyResponseRecord:
        """Save Tavily response to database"""
        try:
            async with get_db() as db:
                # Insert Tavily response
                response_query = text("""
                    INSERT INTO tavily_responses 
                    (scrape_job_id, topic_id, query_text, search_depth, max_results, 
                     tavily_query, follow_up_questions, answer, response_time, request_id, total_results_count)
                    VALUES (:scrape_job_id, :topic_id, :query_text, :search_depth, :max_results,
                            :tavily_query, :follow_up_questions, :answer, :response_time, :request_id, :total_results_count)
                    RETURNING id
                """)
                
                result = await db.execute(response_query, {
                    "scrape_job_id": job_id,
                    "topic_id": topic_data["id"],
                    "query_text": original_query,
                    "search_depth": self.search_depth,
                    "max_results": self.max_results,
                    "tavily_query": response.query,
                    "follow_up_questions": response.follow_up_questions,
                    "answer": response.answer,
                    "response_time": response.response_time,
                    "request_id": response.request_id,
                    "total_results_count": len(response.results)
                })
                
                response_id = result.scalar()
                
                # Insert individual results
                for tavily_result in response.results:
                    # Analyze the result
                    domain = self._extract_domain(tavily_result.url)
                    is_academic = self._is_academic_source(domain)
                    is_clinical = self._is_clinical_source(domain)
                    credibility_score = self._calculate_credibility_score(tavily_result, domain)
                    
                    result_query = text("""
                        INSERT INTO tavily_results 
                        (tavily_response_id, url, title, content, raw_content, score,
                         content_length, domain, is_academic_source, is_clinical_source, 
                         source_credibility_score)
                        VALUES (:tavily_response_id, :url, :title, :content, :raw_content, :score,
                                :content_length, :domain, :is_academic_source, :is_clinical_source,
                                :source_credibility_score)
                    """)
                    
                    await db.execute(result_query, {
                        "tavily_response_id": response_id,
                        "url": tavily_result.url,
                        "title": tavily_result.title,
                        "content": tavily_result.content,
                        "raw_content": tavily_result.raw_content,
                        "score": tavily_result.score,
                        "content_length": len(tavily_result.content) if tavily_result.content else 0,
                        "domain": domain,
                        "is_academic_source": is_academic,
                        "is_clinical_source": is_clinical,
                        "source_credibility_score": credibility_score
                    })
                
                await db.commit()
                
                # Create response record for return
                response_record = TavilyResponseRecord(
                    id=response_id,
                    scrape_job_id=job_id,
                    topic_id=topic_data["id"],
                    query_text=original_query,
                    search_depth=self.search_depth,
                    max_results=self.max_results,
                    tavily_query=response.query,
                    follow_up_questions=response.follow_up_questions,
                    answer=response.answer,
                    images=response.images,
                    response_time=response.response_time,
                    request_id=response.request_id,
                    total_results_count=len(response.results)
                )
                
                logger.info(f"✅ Saved Tavily response for topic {topic_data['topic_name']}: {len(response.results)} results")
                return response_record
                
        except Exception as e:
            logger.error(f"❌ Error saving Tavily response: {e}")
            raise
    
    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL"""
        try:
            parsed = urlparse(url)
            return parsed.netloc.lower().replace('www.', '')
        except:
            return ""
    
    def _is_academic_source(self, domain: str) -> bool:
        """Check if domain is from academic source"""
        academic_indicators = ['.edu', '.org', 'university', 'college', 'academic', 'research']
        return any(indicator in domain.lower() for indicator in academic_indicators)
    
    def _is_clinical_source(self, domain: str) -> bool:
        """Check if domain is from clinical/professional source"""
        clinical_indicators = [
            'aota.org', 'occupationaltherapy', 'pediatric', 'therapy', 
            'clinical', 'medical', 'health', 'hospital', 'clinic'
        ]
        return any(indicator in domain.lower() for indicator in clinical_indicators)
    
    def _calculate_credibility_score(self, result: TavilyResult, domain: str) -> float:
        """Calculate credibility score for a result"""
        score = 0.0
        
        # Base Tavily score (0-1)
        score += result.score * 0.4
        
        # Domain credibility
        if self._is_academic_source(domain):
            score += 0.3
        elif self._is_clinical_source(domain):
            score += 0.25
        elif domain in self._get_preferred_domains():
            score += 0.2
        
        # Content length (longer content generally more valuable)
        content_length = len(result.content) if result.content else 0
        if content_length > 1000:
            score += 0.1
        elif content_length > 500:
            score += 0.05
        
        # Title quality
        if result.title and len(result.title) > 20:
            score += 0.05
        
        return min(score, 1.0)  # Cap at 1.0
