"""
Topic Seeder Service - Generates comprehensive treatment topics for pediatric OT
"""
import logging
from typing import List, Dict
from datetime import datetime
from sqlalchemy import text
from ..db import get_db
from ..models.topics import TreatmentTopic

logger = logging.getLogger(__name__)

class TopicSeeder:
    """Service for seeding treatment topics"""
    
    def __init__(self):
        self.topics_data = self._get_comprehensive_topics()
    
    def _get_comprehensive_topics(self) -> List[Dict]:
        """Get comprehensive list of pediatric OT treatment topics"""
        return [
            # Fine Motor Skills
            {
                "topic_name": "Hand Strength and Dexterity",
                "category": "fine_motor",
                "subcategory": "hand_strength",
                "description": "Activities to improve hand and finger strength for functional tasks",
                "search_keywords": [
                    "pediatric hand strengthening exercises",
                    "finger strength activities children",
                    "hand dexterity occupational therapy kids",
                    "grip strength exercises pediatric OT",
                    "fine motor hand strength activities"
                ],
                "age_range_min": 2,
                "age_range_max": 18
            },
            {
                "topic_name": "Pincer Grasp Development",
                "category": "fine_motor",
                "subcategory": "grasp_patterns",
                "description": "Activities to develop pincer grasp and refined finger movements",
                "search_keywords": [
                    "pincer grasp activities pediatric",
                    "fine motor pinch strength exercises",
                    "thumb finger coordination activities",
                    "precision grasp development children",
                    "occupational therapy pincer grasp"
                ],
                "age_range_min": 1,  # Fixed: 1-6 years for pincer grasp development
                "age_range_max": 6
            },
            {
                "topic_name": "Bilateral Hand Coordination",
                "category": "fine_motor",
                "subcategory": "coordination",
                "description": "Activities requiring both hands to work together effectively",
                "search_keywords": [
                    "bilateral coordination activities pediatric",
                    "two handed activities occupational therapy",
                    "bilateral hand coordination exercises",
                    "crossing midline activities children",
                    "hand coordination pediatric OT"
                ],
                "age_range_min": 2,
                "age_range_max": 12
            },
            {
                "topic_name": "In-Hand Manipulation",
                "category": "fine_motor",
                "subcategory": "manipulation",
                "description": "Skills for manipulating objects within one hand",
                "search_keywords": [
                    "in-hand manipulation activities",
                    "finger to palm translation exercises",
                    "palm to finger translation activities",
                    "finger to finger translation pediatric",
                    "rotation activities occupational therapy"
                ],
                "age_range_min": 3,
                "age_range_max": 10
            },
            {
                "topic_name": "Scissor Skills Development",
                "category": "fine_motor",
                "subcategory": "tool_use",
                "description": "Progressive scissor skills for cutting activities",
                "search_keywords": [
                    "scissor skills activities pediatric",
                    "cutting skills occupational therapy",
                    "scissor grasp development children",
                    "fine motor cutting exercises",
                    "pre-scissor skills activities"
                ],
                "age_range_min": 2,
                "age_range_max": 8
            },
            
            # Gross Motor Skills
            {
                "topic_name": "Core Stability and Strength",
                "category": "gross_motor",
                "subcategory": "core_strength",
                "description": "Activities to improve trunk stability and core strength",
                "search_keywords": [
                    "core strengthening pediatric occupational therapy",
                    "trunk stability activities children",
                    "postural control exercises pediatric",
                    "core stability activities kids",
                    "pediatric core strength exercises"
                ],
                "age_range_min": 1,
                "age_range_max": 18
            },
            {
                "topic_name": "Balance and Postural Control",
                "category": "gross_motor",
                "subcategory": "balance",
                "description": "Activities to improve static and dynamic balance",
                "search_keywords": [
                    "balance activities pediatric occupational therapy",
                    "postural control exercises children",
                    "dynamic balance activities kids",
                    "static balance exercises pediatric",
                    "equilibrium activities occupational therapy"
                ],
                "age_range_min": 2,
                "age_range_max": 18
            },
            {
                "topic_name": "Motor Planning and Coordination",
                "category": "gross_motor",
                "subcategory": "motor_planning",
                "description": "Activities to improve motor planning and gross motor coordination",
                "search_keywords": [
                    "motor planning activities pediatric",
                    "praxis exercises occupational therapy",
                    "gross motor coordination activities",
                    "movement planning exercises children",
                    "dyspraxia activities pediatric OT"
                ],
                "age_range_min": 3,
                "age_range_max": 18
            },
            {
                "topic_name": "Proprioceptive Awareness",
                "category": "gross_motor",
                "subcategory": "proprioception",
                "description": "Activities to improve body awareness and proprioceptive input",
                "search_keywords": [
                    "proprioceptive activities pediatric",
                    "body awareness exercises children",
                    "heavy work activities occupational therapy",
                    "proprioceptive input activities kids",
                    "sensory proprioception pediatric OT"
                ],
                "age_range_min": 2,
                "age_range_max": 18
            },
            
            # Sensory Processing
            {
                "topic_name": "Tactile Processing and Desensitization",
                "category": "sensory_processing",
                "subcategory": "tactile",
                "description": "Activities to improve tactile processing and reduce tactile defensiveness",
                "search_keywords": [
                    "tactile desensitization activities pediatric",
                    "tactile processing exercises children",
                    "sensory tactile activities occupational therapy",
                    "tactile defensiveness treatment pediatric",
                    "touch sensitivity activities kids"
                ],
                "age_range_min": 1,
                "age_range_max": 18
            },
            {
                "topic_name": "Vestibular Processing",
                "category": "sensory_processing",
                "subcategory": "vestibular",
                "description": "Activities to improve vestibular processing and movement tolerance",
                "search_keywords": [
                    "vestibular activities pediatric occupational therapy",
                    "movement activities sensory processing",
                    "vestibular input exercises children",
                    "balance vestibular activities kids",
                    "motion sensitivity treatment pediatric"
                ],
                "age_range_min": 1,
                "age_range_max": 18
            },
            {
                "topic_name": "Auditory Processing",
                "category": "sensory_processing",
                "subcategory": "auditory",
                "description": "Activities to improve auditory processing and sound tolerance",
                "search_keywords": [
                    "auditory processing activities pediatric",
                    "sound sensitivity treatment children",
                    "auditory desensitization exercises",
                    "listening skills activities occupational therapy",
                    "auditory defensiveness pediatric OT"
                ],
                "age_range_min": 2,
                "age_range_max": 18
            },
            {
                "topic_name": "Sensory Modulation",
                "category": "sensory_processing",
                "subcategory": "modulation",
                "description": "Activities to improve sensory modulation and self-regulation",
                "search_keywords": [
                    "sensory modulation activities pediatric",
                    "self-regulation exercises children",
                    "sensory diet activities occupational therapy",
                    "sensory regulation strategies kids",
                    "sensory processing disorder treatment"
                ],
                "age_range_min": 2,
                "age_range_max": 18
            },
            
            # Visual-Perceptual Skills
            {
                "topic_name": "Visual Discrimination",
                "category": "visual_perceptual",
                "subcategory": "discrimination",
                "description": "Activities to improve ability to distinguish visual differences",
                "search_keywords": [
                    "visual discrimination activities pediatric",
                    "visual perception exercises children",
                    "visual processing activities occupational therapy",
                    "visual attention activities kids",
                    "visual scanning exercises pediatric OT"
                ],
                "age_range_min": 3,
                "age_range_max": 12
            },
            {
                "topic_name": "Visual Memory",
                "category": "visual_perceptual",
                "subcategory": "memory",
                "description": "Activities to improve visual memory and recall",
                "search_keywords": [
                    "visual memory activities pediatric",
                    "visual recall exercises children",
                    "visual sequential memory activities",
                    "visual memory games occupational therapy",
                    "visual memory skills pediatric OT"
                ],
                "age_range_min": 3,
                "age_range_max": 15
            },
            {
                "topic_name": "Spatial Relationships",
                "category": "visual_perceptual",
                "subcategory": "spatial",
                "description": "Activities to improve understanding of spatial relationships",
                "search_keywords": [
                    "spatial relationships activities pediatric",
                    "spatial awareness exercises children",
                    "visual spatial activities occupational therapy",
                    "position in space activities kids",
                    "spatial processing pediatric OT"
                ],
                "age_range_min": 3,
                "age_range_max": 15
            },
            {
                "topic_name": "Figure-Ground Perception",
                "category": "visual_perceptual",
                "subcategory": "figure_ground",
                "description": "Activities to improve figure-ground discrimination",
                "search_keywords": [
                    "figure ground activities pediatric",
                    "visual figure ground exercises",
                    "visual perception figure ground activities",
                    "visual processing figure ground children",
                    "figure ground discrimination occupational therapy"
                ],
                "age_range_min": 4,
                "age_range_max": 12
            },
            
            # Cognitive Skills
            {
                "topic_name": "Attention and Concentration",
                "category": "cognitive",
                "subcategory": "attention",
                "description": "Activities to improve sustained attention and concentration",
                "search_keywords": [
                    "attention activities pediatric occupational therapy",
                    "concentration exercises children",
                    "focus activities kids occupational therapy",
                    "sustained attention activities pediatric",
                    "attention span exercises children"
                ],
                "age_range_min": 3,
                "age_range_max": 18
            },
            {
                "topic_name": "Executive Functioning",
                "category": "cognitive",
                "subcategory": "executive_function",
                "description": "Activities to improve planning, organization, and problem-solving",
                "search_keywords": [
                    "executive function activities pediatric",
                    "planning skills exercises children",
                    "organization activities occupational therapy",
                    "problem solving activities kids",
                    "executive functioning pediatric OT"
                ],
                "age_range_min": 5,
                "age_range_max": 18
            },
            {
                "topic_name": "Working Memory",
                "category": "cognitive",
                "subcategory": "memory",
                "description": "Activities to improve working memory and information processing",
                "search_keywords": [
                    "working memory activities pediatric",
                    "memory exercises children occupational therapy",
                    "information processing activities kids",
                    "memory skills pediatric OT",
                    "cognitive memory activities children"
                ],
                "age_range_min": 4,
                "age_range_max": 18
            },
            
            # Activities of Daily Living
            {
                "topic_name": "Self-Feeding Skills",
                "category": "activities_daily_living",
                "subcategory": "feeding",
                "description": "Activities to improve independent feeding and mealtime skills",
                "search_keywords": [
                    "feeding skills activities pediatric",
                    "self-feeding exercises children",
                    "mealtime skills occupational therapy",
                    "feeding independence activities kids",
                    "oral motor feeding activities pediatric"
                ],
                "age_range_min": 0,
                "age_range_max": 8
            },
            {
                "topic_name": "Dressing Skills",
                "category": "activities_daily_living",
                "subcategory": "dressing",
                "description": "Activities to improve independent dressing and clothing management",
                "search_keywords": [
                    "dressing skills activities pediatric",
                    "clothing independence exercises children",
                    "dressing activities occupational therapy",
                    "self-care dressing skills kids",
                    "clothing fasteners activities pediatric"
                ],
                "age_range_min": 2,
                "age_range_max": 10
            },
            {
                "topic_name": "Grooming and Hygiene",
                "category": "activities_daily_living",
                "subcategory": "hygiene",
                "description": "Activities to improve personal hygiene and grooming skills",
                "search_keywords": [
                    "hygiene skills activities pediatric",
                    "grooming activities children occupational therapy",
                    "self-care hygiene skills kids",
                    "personal care activities pediatric OT",
                    "hygiene independence exercises children"
                ],
                "age_range_min": 2,
                "age_range_max": 18
            },
            
            # School Readiness
            {
                "topic_name": "Pre-Writing Skills",
                "category": "school_readiness",
                "subcategory": "pre_writing",
                "description": "Activities to develop pre-writing and writing readiness skills",
                "search_keywords": [
                    "pre-writing activities pediatric occupational therapy",
                    "writing readiness exercises children",
                    "pre-writing skills activities kids",
                    "writing preparation pediatric OT",
                    "fine motor pre-writing activities"
                ],
                "age_range_min": 2,
                "age_range_max": 6
            },
            {
                "topic_name": "Handwriting Development",
                "category": "school_readiness",
                "subcategory": "handwriting",
                "description": "Activities to improve handwriting legibility and speed",
                "search_keywords": [
                    "handwriting activities pediatric occupational therapy",
                    "writing skills exercises children",
                    "handwriting improvement activities kids",
                    "legible writing activities pediatric OT",
                    "handwriting fluency exercises children"
                ],
                "age_range_min": 4,
                "age_range_max": 15
            },
            {
                "topic_name": "Classroom Behaviors and Attention",
                "category": "school_readiness",
                "subcategory": "classroom_behavior",
                "description": "Activities to improve classroom attention and appropriate behaviors",
                "search_keywords": [
                    "classroom behavior activities pediatric",
                    "school attention exercises children",
                    "classroom skills occupational therapy",
                    "school readiness behavior activities",
                    "classroom participation pediatric OT"
                ],
                "age_range_min": 3,
                "age_range_max": 12
            },
            
            # Play and Leisure
            {
                "topic_name": "Imaginative Play Skills",
                "category": "play_leisure",
                "subcategory": "imaginative_play",
                "description": "Activities to develop imaginative and creative play skills",
                "search_keywords": [
                    "imaginative play activities pediatric",
                    "creative play exercises children",
                    "pretend play activities occupational therapy",
                    "play skills development kids",
                    "symbolic play activities pediatric OT"
                ],
                "age_range_min": 2,
                "age_range_max": 10
            },
            {
                "topic_name": "Social Play Skills",
                "category": "play_leisure",
                "subcategory": "social_play",
                "description": "Activities to improve social interaction during play",
                "search_keywords": [
                    "social play activities pediatric",
                    "cooperative play exercises children",
                    "social skills play activities",
                    "peer interaction activities occupational therapy",
                    "social play development pediatric OT"
                ],
                "age_range_min": 2,
                "age_range_max": 18
            },
            {
                "topic_name": "Game Participation",
                "category": "play_leisure",
                "subcategory": "games",
                "description": "Activities to improve participation in structured games and sports",
                "search_keywords": [
                    "game participation activities pediatric",
                    "sports skills exercises children",
                    "game playing activities occupational therapy",
                    "recreational activities kids",
                    "leisure skills pediatric OT"
                ],
                "age_range_min": 4,
                "age_range_max": 18
            }
        ]
    
    async def seed_topics(self, version: int = 1, overwrite_existing: bool = False) -> Dict:
        """Seed treatment topics into database"""
        try:
            topics_created = 0
            
            async with get_db() as db:
                # Check if topics already exist for this version
                if not overwrite_existing:
                    existing_check = await db.execute(
                        text("SELECT COUNT(*) FROM treatment_topics WHERE version = :version"),
                        {"version": version}
                    )
                    existing_count = existing_check.scalar()
                    
                    if existing_count > 0:
                        return {
                            "success": False,
                            "message": f"Topics already exist for version {version}. Use overwrite_existing=True to replace.",
                            "topics_created": 0,
                            "version": version
                        }
                
                # Delete existing topics for this version if overwriting
                if overwrite_existing:
                    await db.execute(
                        text("DELETE FROM treatment_topics WHERE version = :version"),
                        {"version": version}
                    )
                
                # Insert new topics
                for topic_data in self.topics_data:
                    insert_query = text("""
                        INSERT INTO treatment_topics 
                        (topic_name, category, subcategory, search_keywords, age_range_min, age_range_max, description, version)
                        VALUES (:topic_name, :category, :subcategory, :search_keywords, :age_range_min, :age_range_max, :description, :version)
                    """)
                    
                    await db.execute(insert_query, {
                        "topic_name": topic_data["topic_name"],
                        "category": topic_data["category"],
                        "subcategory": topic_data.get("subcategory"),
                        "search_keywords": topic_data["search_keywords"],
                        "age_range_min": topic_data["age_range_min"],
                        "age_range_max": topic_data["age_range_max"],
                        "description": topic_data.get("description"),
                        "version": version
                    })
                    topics_created += 1
                
                await db.commit()
                
            logger.info(f"✅ Successfully seeded {topics_created} topics for version {version}")
            
            return {
                "success": True,
                "message": f"Successfully created {topics_created} treatment topics",
                "topics_created": topics_created,
                "version": version
            }
            
        except Exception as e:
            logger.error(f"❌ Error seeding topics: {e}")
            return {
                "success": False,
                "message": f"Error seeding topics: {str(e)}",
                "topics_created": 0,
                "version": version
            }
    
    async def get_topics_by_version(self, version: int) -> List[Dict]:
        """Get all topics for a specific version"""
        try:
            async with get_db() as db:
                result = await db.execute(
                    text("""
                        SELECT id, topic_name, category, subcategory, search_keywords, 
                               age_range_min, age_range_max, description, created_at
                        FROM treatment_topics 
                        WHERE version = :version AND is_active = true
                        ORDER BY category, subcategory, topic_name
                    """),
                    {"version": version}
                )
                
                topics = []
                for row in result.fetchall():
                    topics.append({
                        "id": row.id,
                        "topic_name": row.topic_name,
                        "category": row.category,
                        "subcategory": row.subcategory,
                        "search_keywords": row.search_keywords,
                        "age_range_min": row.age_range_min,
                        "age_range_max": row.age_range_max,
                        "description": row.description,
                        "created_at": row.created_at
                    })
                
                return topics
                
        except Exception as e:
            logger.error(f"❌ Error fetching topics: {e}")
            return []
    
    async def get_topics_by_ids(self, topic_ids: List[int]) -> List[Dict]:
        """Get specific topics by their IDs"""
        try:
            async with get_db() as db:
                # Convert list to tuple for SQL IN clause
                placeholders = ','.join([f':id_{i}' for i in range(len(topic_ids))])
                params = {f'id_{i}': topic_id for i, topic_id in enumerate(topic_ids)}
                
                result = await db.execute(
                    text(f"""
                        SELECT id, topic_name, category, subcategory, search_keywords, 
                               age_range_min, age_range_max, description, created_at
                        FROM treatment_topics 
                        WHERE id IN ({placeholders}) AND is_active = true
                        ORDER BY category, subcategory, topic_name
                    """),
                    params
                )
                
                topics = []
                for row in result:
                    topics.append({
                        "id": row.id,
                        "topic_name": row.topic_name,
                        "category": row.category,
                        "subcategory": row.subcategory,
                        "search_keywords": row.search_keywords,
                        "age_range_min": row.age_range_min,
                        "age_range_max": row.age_range_max,
                        "description": row.description,
                        "created_at": row.created_at
                    })
                
                logger.info(f"✅ Retrieved {len(topics)} specific topics")
                return topics
                
        except Exception as e:
            logger.error(f"❌ Error fetching specific topics: {e}")
            return []
    
    async def get_latest_version(self) -> int:
        """Get the latest version number"""
        try:
            async with get_db() as db:
                result = await db.execute(
                    text("SELECT MAX(version) FROM treatment_topics")
                )
                latest_version = result.scalar()
                return latest_version if latest_version is not None else 0
                
        except Exception as e:
            logger.error(f"❌ Error getting latest version: {e}")
            return 0
