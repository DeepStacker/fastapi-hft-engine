"""
Support System Admin APIs
"""
import logging
import json
from typing import List, Optional
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload

from app.config.database import get_db
from app.core.dependencies import CurrentUser
from app.models.support import SupportTicket, TicketMessage, TicketStatus, TicketCategory
from app.models.user import UserRole, User
from app.models.notification import NotificationPriority

logger = logging.getLogger(__name__)
router = APIRouter()

# ============== Schemas ==============

class TicketStatusUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None

class AdminReplyCreate(BaseModel):
    message: str
    attachments: Optional[List[str]] = []

class AdminTicketResponse(BaseModel):
    id: str
    user_id: str
    user_email: str
    user_name: Optional[str]
    ticket_id: str
    subject: str
    category: str
    status: str
    priority: str
    created_at: str
    updated_at: str
    message_count: int

class TicketDetailResponse(BaseModel):
    id: str
    user_id: str
    user_email: str
    user_name: Optional[str]
    ticket_id: str
    subject: str
    category: str
    status: str
    priority: str
    created_at: str
    updated_at: str
    messages: List[dict] # Reuse similar structure as User API

# ============== Dependencies ==============

def require_admin(current_user: CurrentUser):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ============== Endpoints ==============

@router.get("/tickets", response_model=dict)
async def list_all_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all tickets for admin"""
    
    query = select(SupportTicket).options(
        selectinload(SupportTicket.user)
    )
    
    if status:
        query = query.where(SupportTicket.status == status)
        
    if priority:
        query = query.where(SupportTicket.priority == priority)
        
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Pagination
    query = query.order_by(desc(SupportTicket.created_at)).offset((page - 1) * limit).limit(limit)
    
    result = await db.execute(query)
    tickets = result.scalars().all()
    
    return {
        "success": True,
        "total": total,
        "page": page,
        "tickets": [
            AdminTicketResponse(
                id=str(t.id),
                user_id=str(t.user_id),
                user_email=t.user.email,
                user_name=t.user.full_name or t.user.username,
                ticket_id=t.ticket_id,
                subject=t.subject,
                category=t.category.value,
                status=t.status.value,
                priority=t.priority.value,
                created_at=t.created_at.isoformat(),
                updated_at=t.updated_at.isoformat(),
                message_count=0 # Optimize later
            )
            for t in tickets
        ]
    }

@router.get("/tickets/{ticket_id}", response_model=TicketDetailResponse)
async def get_ticket_detail(
    ticket_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get ticket details for admin"""
    
    try:
        t_uuid = UUID(ticket_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
        
    query = (
        select(SupportTicket)
        .where(SupportTicket.id == t_uuid)
        .options(
            selectinload(SupportTicket.user),
            selectinload(SupportTicket.messages).selectinload(TicketMessage.sender)
        )
    )
    
    result = await db.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    return TicketDetailResponse(
        id=str(ticket.id),
        user_id=str(ticket.user_id),
        user_email=ticket.user.email,
        user_name=ticket.user.full_name or ticket.user.username,
        ticket_id=ticket.ticket_id,
        subject=ticket.subject,
        category=ticket.category.value,
        status=ticket.status.value,
        priority=ticket.priority.value,
        created_at=ticket.created_at.isoformat(),
        updated_at=ticket.updated_at.isoformat(),
        messages=[
            {
                "id": str(m.id),
                "sender_id": str(m.sender_id) if m.sender_id else None,
                "sender_name": m.sender.full_name if m.sender else ("Support Agent" if m.is_admin else "System"),
                "is_admin": m.is_admin,
                "message": m.message,
                "created_at": m.created_at.isoformat(),
                "attachments": json.loads(m.attachments) if m.attachments else []
            }
            for m in ticket.messages
        ]
    )

@router.patch("/tickets/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    update_data: TicketStatusUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update ticket status or priority"""
    
    try:
        t_uuid = UUID(ticket_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
        
    query = select(SupportTicket).where(SupportTicket.id == t_uuid)
    result = await db.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if update_data.status:
        try:
            ticket.status = TicketStatus(update_data.status)
        except ValueError:
             raise HTTPException(status_code=400, detail="Invalid status")
             
    if update_data.priority:
        try:
            ticket.priority = NotificationPriority(update_data.priority)
        except ValueError:
             raise HTTPException(status_code=400, detail="Invalid priority")
             
    ticket.updated_at = datetime.utcnow()
    await db.commit()
    
    logger.info(f"Admin {current_user.id} updated ticket {ticket.ticket_id}")
    
    return {"success": True, "message": "Ticket updated"}

from app.api.websocket.support_manager import manager

@router.post("/tickets/{ticket_id}/messages")
async def admin_reply(
    ticket_id: str,
    reply_data: AdminReplyCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Reply to a ticket as admin"""
    
    try:
        t_uuid = UUID(ticket_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
        
    query = select(SupportTicket).where(SupportTicket.id == t_uuid)
    result = await db.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    # Create message
    new_message = TicketMessage(
        ticket_id=ticket.id,
        sender_id=current_user.id,
        is_admin=True,
        message=reply_data.message,
        attachments=json.dumps(reply_data.attachments) if reply_data.attachments else None
    )
    db.add(new_message)
    
    # Auto update status to IN_PROGRESS or RESOLVED if needed?
    if ticket.status == TicketStatus.OPEN:
        ticket.status = TicketStatus.IN_PROGRESS
        
    ticket.updated_at = datetime.utcnow()
    
    await db.commit()
    
    # Broadcast to WebSocket
    ws_payload = {
        "type": "message",
        "id": str(new_message.id),
        "sender_id": str(current_user.id),
        "sender_name": "Support Agent", # Should probably be admin name but anon is okay
        "is_admin": True,
        "message": new_message.message,
        "created_at": new_message.created_at.isoformat(),
        "attachments": reply_data.attachments or []
    }
    await manager.broadcast(str(ticket.id), ws_payload)
    
    # Notify User via NotificationDispatcher
    from app.services.notification_dispatcher import NotificationDispatcher
    dispatcher = NotificationDispatcher(db)
    
    await dispatcher.send(
        user_id=ticket.user_id,
        title=f"New Reply on Ticket {ticket.ticket_id}",
        message=f"Support Agent: {new_message.message[:100]}..." if len(new_message.message) > 100 else f"Support Agent: {new_message.message}",
        type="info",
        purpose="support", # Ensure this exists or use 'informative'
        priority="high",
        link=f"/support", # Link to support center
        action_url=f"/support",
        action_label="View Ticket"
    )
    
    return {"success": True, "message": "Reply sent"}
