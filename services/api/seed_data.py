#!/usr/bin/env python3
"""
Seed script to add sample data for TheraVillage
"""
import asyncio
import os
import sys
import json
from datetime import datetime, date, timedelta
from sqlalchemy import text
from app.db import get_db, create_database_engine

async def seed_sample_data():
    """Add sample clients and appointments to the database"""
    print("🌱 Seeding sample data...")
    
    # Get database connection
    await create_database_engine()
    from app.db import engine
    
    if not engine:
        print("❌ Failed to create database engine")
        return
    
    print("✅ Database engine created successfully")
    
    async with engine.begin() as conn:
        try:
            # First, let's find a therapist user
            result = await conn.execute(
                text("SELECT id FROM users WHERE role = 'therapist' LIMIT 1")
            )
            therapist_row = result.fetchone()
            
            if not therapist_row:
                print("❌ No therapist found in database. Please register a therapist first.")
                return
            
            therapist_id = therapist_row[0]
            print(f"✅ Found therapist with ID: {therapist_id}")
            
            # Create sample clients
            sample_clients = [
                {
                    "name": "Alex Smith",
                    "email": "alex.smith@example.com",
                    "dob": date(2010, 5, 15),
                    "school": "Lincoln Elementary",
                    "address": {"street": "123 Main St", "city": "Springfield", "state": "IL", "zip": "62701"}
                },
                {
                    "name": "Emma Johnson",
                    "email": "emma.johnson@example.com",
                    "dob": date(2009, 8, 22),
                    "school": "Washington Middle",
                    "address": {"street": "456 Oak Ave", "city": "Springfield", "state": "IL", "zip": "62702"}
                },
                {
                    "name": "Mike Davis",
                    "email": "mike.davis@example.com",
                    "dob": date(2011, 3, 10),
                    "school": "Roosevelt High",
                    "address": {"street": "789 Pine Rd", "city": "Springfield", "state": "IL", "zip": "62703"}
                }
            ]
            
            created_clients = []
            for client_data in sample_clients:
                # Check if client already exists
                result = await conn.execute(
                    text("SELECT id FROM users WHERE email = :email"),
                    {"email": client_data["email"]}
                )
                
                if result.fetchone():
                    print(f"⚠️  Client {client_data['name']} already exists, skipping...")
                    continue
                
                # Create client user
                result = await conn.execute(
                    text("""
                        INSERT INTO users (org_id, name, email, role, status)
                        VALUES (1, :name, :email, 'client', 'active')
                        RETURNING id
                    """),
                    {
                        "name": client_data["name"],
                        "email": client_data["email"]
                    }
                )
                client_id = result.fetchone()[0]
                
                # Create client profile
                await conn.execute(
                    text("""
                        INSERT INTO client_profiles (user_id, dob, address, school)
                        VALUES (:user_id, :dob, :address, :school)
                    """),
                    {
                        "user_id": client_id,
                        "dob": client_data["dob"],
                        "address": json.dumps(client_data["address"]),
                        "school": client_data["school"]
                    }
                )
                
                # Assign to therapist
                await conn.execute(
                    text("""
                        INSERT INTO therapist_assignments (therapist_id, client_id, start_date)
                        VALUES (:therapist_id, :client_id, :start_date)
                    """),
                    {
                        "therapist_id": therapist_id,
                        "client_id": client_id,
                        "start_date": date.today()
                    }
                )
                
                created_clients.append(client_id)
                print(f"✅ Created client: {client_data['name']} (ID: {client_id})")
            
            # Create sample appointments for today
            today = date.today()
            tomorrow = today + timedelta(days=1)
            
            sample_appointments = [
                {
                    "client_id": created_clients[0] if len(created_clients) > 0 else None,
                    "start_ts": datetime.combine(today, datetime.min.time().replace(hour=9, minute=0)),
                    "end_ts": datetime.combine(today, datetime.min.time().replace(hour=10, minute=0)),
                    "status": "scheduled"
                },
                {
                    "client_id": created_clients[1] if len(created_clients) > 1 else None,
                    "start_ts": datetime.combine(today, datetime.min.time().replace(hour=14, minute=0)),
                    "end_ts": datetime.combine(today, datetime.min.time().replace(hour=15, minute=0)),
                    "status": "scheduled"
                },
                {
                    "client_id": created_clients[2] if len(created_clients) > 2 else None,
                    "start_ts": datetime.combine(tomorrow, datetime.min.time().replace(hour=10, minute=0)),
                    "end_ts": datetime.combine(tomorrow, datetime.min.time().replace(hour=11, minute=0)),
                    "status": "scheduled"
                }
            ]
            
            for appointment_data in sample_appointments:
                if not appointment_data["client_id"]:
                    continue
                    
                # Check if appointment already exists
                result = await conn.execute(
                    text("""
                        SELECT 1 FROM appointments 
                        WHERE client_id = :client_id AND therapist_id = :therapist_id 
                        AND start_ts = :start_ts
                    """),
                    {
                        "client_id": appointment_data["client_id"],
                        "therapist_id": therapist_id,
                        "start_ts": appointment_data["start_ts"]
                    }
                )
                
                if result.fetchone():
                    print(f"⚠️  Appointment already exists for {appointment_data['start_ts']}, skipping...")
                    continue
                
                # Create appointment
                await conn.execute(
                    text("""
                        INSERT INTO appointments (org_id, client_id, therapist_id, start_ts, end_ts, status)
                        VALUES (1, :client_id, :therapist_id, :start_ts, :end_ts, :status)
                    """),
                    {
                        "client_id": appointment_data["client_id"],
                        "therapist_id": therapist_id,
                        "start_ts": appointment_data["start_ts"],
                        "end_ts": appointment_data["end_ts"],
                        "status": appointment_data["status"]
                    }
                )
                
                print(f"✅ Created appointment: {appointment_data['start_ts'].strftime('%Y-%m-%d %H:%M')} - {appointment_data['end_ts'].strftime('%H:%M')}")
            
            print("🎉 Sample data seeding completed successfully!")
            
        except Exception as e:
            print(f"❌ Error seeding data: {e}")
            raise

if __name__ == "__main__":
    asyncio.run(seed_sample_data())
