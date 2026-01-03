import logging
import random
import string
import shutil
import os
import json
from typing import List, Optional
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Body, File, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.config.database import get_db
from app.core.dependencies import CurrentUser
from app.models.support import SupportTicket, TicketMessage, TicketStatus, TicketCategory
from app.models.notification import NotificationPriority

logger = logging.getLogger(__name__)
router = APIRouter()

# ============== Schemas ==============

class TicketCreate(BaseModel):
    subject: str = Field(..., min_length=5, max_length=200)
    category: str
    message: str = Field(..., min_length=10)
    priority: str = "normal"
    attachments: Optional[List[str]] = []

class MessageCreate(BaseModel):
    message: str = Field(..., min_length=1)
    attachments: Optional[List[str]] = []

class TicketMessageResponse(BaseModel):
    id: str
    sender_id: Optional[str]
    sender_name: Optional[str] = None
    is_admin: bool
    message: str
    created_at: str
    attachments: List[str] = []

class TicketResponse(BaseModel):
    id: str
    ticket_id: str
    subject: str
    category: str
    status: str
    priority: str
    created_at: str
    updated_at: str
    messages: List[TicketMessageResponse] = []

class TicketListResponse(BaseModel):
    success: bool
    total: int
    tickets: List[TicketResponse]

class FileUploadResponse(BaseModel):
    success: bool
    url: str
    filename: str

# ============== Helpers ==============

def generate_ticket_id():
    """Generate a random ticket ID like TKT-12345"""
    suffix = ''.join(random.choices(string.digits, k=6))
    return f"TKT-{suffix}"

# ============== Endpoints ==============

@router.post("/tickets/upload", response_model=FileUploadResponse)
async def upload_file(
    current_user: CurrentUser, # Just require auth
    file: UploadFile = File(...),
):
    """Upload a file for support ticket"""
    # Validation
    ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "application/pdf", "text/plain"]
    MAX_SIZE = 5 * 1024 * 1024 # 5MB
    
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type")
        
    # Generate filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    safe_filename = f"{current_user.id}_{timestamp}_{random.randint(1000,9999)}.{ext}"
    
    upload_dir = "static/uploads"
    file_path = os.path.join(upload_dir, safe_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        raise HTTPException(status_code=500, detail="File upload failed")
        
    url = f"/static/uploads/{safe_filename}"
    
    return FileUploadResponse(
        success=True,
        url=url,
        filename=file.filename
    )

@router.post("/tickets", response_model=TicketResponse)
async def create_ticket(
    ticket_data: TicketCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """Create a new support ticket"""
    
    # Generate unique ticket ID
    ticket_id = generate_ticket_id()
    
    # Map category and priority
    try:
        category_enum = TicketCategory(ticket_data.category)
    except ValueError:
        category_enum = TicketCategory.OTHER
        
    try:
        priority_enum = NotificationPriority(ticket_data.priority)
    except ValueError:
        priority_enum = NotificationPriority.NORMAL

    # Create ticket
    new_ticket = SupportTicket(
        user_id=current_user.id,
        ticket_id=ticket_id,
        subject=ticket_data.subject,
        category=category_enum,
        status=TicketStatus.OPEN,
        priority=priority_enum
    )
    db.add(new_ticket)
    await db.flush() # Get ID for message
    
    # Create initial message
    initial_message = TicketMessage(
        ticket_id=new_ticket.id,
        sender_id=current_user.id,
        is_admin=False,
        message=ticket_data.message,
        attachments=json.dumps(ticket_data.attachments) if ticket_data.attachments else None
    )
    db.add(initial_message)
    
    await db.commit()
    await db.refresh(new_ticket)
    
    logger.info(f"User {current_user.id} created ticket {ticket_id}")
    
    # Format response
    return TicketResponse(
        id=str(new_ticket.id),
        ticket_id=new_ticket.ticket_id,
        subject=new_ticket.subject,
        category=new_ticket.category.value,
        status=new_ticket.status.value,
        priority=new_ticket.priority.value,
        created_at=new_ticket.created_at.isoformat(),
        updated_at=new_ticket.updated_at.isoformat(),
        messages=[
            TicketMessageResponse(
                id=str(initial_message.id),
                sender_id=str(current_user.id),
                sender_name=current_user.full_name or current_user.username,
                is_admin=False,
                message=initial_message.message,
                created_at=initial_message.created_at.isoformat(),
                attachments=json.loads(initial_message.attachments) if initial_message.attachments else []
            )
        ]
    )

@router.get("/tickets", response_model=TicketListResponse)
async def list_tickets(
    current_user: CurrentUser,
    status: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """List user's tickets"""
    
    query = select(SupportTicket).where(SupportTicket.user_id == current_user.id)
    
    if status:
        query = query.where(SupportTicket.status == status)
        
    query = query.order_by(desc(SupportTicket.updated_at)).limit(limit)
    
    # Load relationships if needed, though list view might not need messages
    # For now, let's keep it light
    
    result = await db.execute(query)
    tickets = result.scalars().all()
    
    return TicketListResponse(
        success=True,
        total=len(tickets),
        tickets=[
            TicketResponse(
                id=str(t.id),
                ticket_id=t.ticket_id,
                subject=t.subject,
                category=t.category.value,
                status=t.status.value,
                priority=t.priority.value,
                created_at=t.created_at.isoformat(),
                updated_at=t.updated_at.isoformat(),
                messages=[] # Don't load messages for list view
            )
            for t in tickets
        ]
    )

@router.get("/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """Get ticket details with messages"""
    
    try:
        t_uuid = UUID(ticket_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
        
    query = (
        select(SupportTicket)
        .where(
            SupportTicket.id == t_uuid,
            SupportTicket.user_id == current_user.id
        )
        .options(
            selectinload(SupportTicket.messages).selectinload(TicketMessage.sender)
        )
    )
    
    result = await db.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    return TicketResponse(
        id=str(ticket.id),
        ticket_id=ticket.ticket_id,
        subject=ticket.subject,
        category=ticket.category.value,
        status=ticket.status.value,
        priority=ticket.priority.value,
        created_at=ticket.created_at.isoformat(),
        updated_at=ticket.updated_at.isoformat(),
        messages=[
            TicketMessageResponse(
                id=str(m.id),
                sender_id=str(m.sender_id) if m.sender_id else None,
                sender_name=m.sender.full_name if m.sender else "Support Agent",
                is_admin=m.is_admin,
                message=m.message,
                created_at=m.created_at.isoformat(),
                attachments=json.loads(m.attachments) if m.attachments else []
            )
            for m in ticket.messages
        ]
    )
    
from app.api.websocket.support_manager import manager

@router.post("/tickets/{ticket_id}/messages", response_model=TicketResponse)
async def send_message(
    ticket_id: str,
    message_data: MessageCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """Add a message to a ticket"""
    
    try:
        t_uuid = UUID(ticket_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
        
    # Get ticket
    query = select(SupportTicket).where(
        SupportTicket.id == t_uuid,
        SupportTicket.user_id == current_user.id
    )
    result = await db.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if ticket.status == TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot reply to closed ticket")
        
    # Create message
    new_message = TicketMessage(
        ticket_id=ticket.id,
        sender_id=current_user.id,
        is_admin=False,
        message=message_data.message,
        attachments=json.dumps(message_data.attachments) if message_data.attachments else None
    )
    db.add(new_message)
    
    # Update ticket status if resolved -> open? Or just update timestamp
    ticket.updated_at = datetime.utcnow()
    # Optionally re-open if it was resolved
    if ticket.status == TicketStatus.RESOLVED:
        ticket.status = TicketStatus.IN_PROGRESS
        
    await db.commit()
    
    # Broadcast to WebSocket
    ws_payload = {
        "type": "message",
        "id": str(new_message.id),
        "sender_id": str(current_user.id),
        "sender_name": current_user.full_name or current_user.username,
        "is_admin": False,
        "message": new_message.message,
        "created_at": new_message.created_at.isoformat(),
        "attachments": message_data.attachments or []
    }
    await manager.broadcast(str(ticket.id), ws_payload)
    
    # Return updated ticket
    return await get_ticket(ticket_id, current_user, db)
