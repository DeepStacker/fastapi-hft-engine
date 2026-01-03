"""
Support System Models
"""
import enum
from uuid import uuid4
from sqlalchemy import Column, String, Boolean, Enum, Text, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin
from app.models.notification import NotificationPriority
from app.models.user import User

class TicketStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"

class TicketCategory(str, enum.Enum):
    ISSUE = "issue"
    MARKET_DATA = "market_data"
    FEATURE_REQUEST = "feature_request"
    BILLING = "billing"
    OTHER = "other"

class SupportTicket(Base, TimestampMixin):
    """
    Support Ticket model
    """
    __tablename__ = "support_tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    
    # User relationship
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("app_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Ticket details
    ticket_id = Column(String(20), unique=True, index=True)  # Human readable ID e.g. TKT-1234
    subject = Column(String(200), nullable=False)
    category = Column(Enum(TicketCategory), default=TicketCategory.OTHER, nullable=False)
    status = Column(Enum(TicketStatus), default=TicketStatus.OPEN, nullable=False)
    priority = Column(Enum(NotificationPriority), default=NotificationPriority.NORMAL, nullable=False)
    
    # Relationships
    messages = relationship("TicketMessage", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketMessage.created_at")
    user = relationship(User, backref="tickets", lazy="joined")

    def __repr__(self):
        return f"<SupportTicket {self.ticket_id} - {self.status.value}>"

class TicketMessage(Base, TimestampMixin):
    """
    Message within a support ticket
    """
    __tablename__ = "ticket_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    
    ticket_id = Column(
        UUID(as_uuid=True),
        ForeignKey("support_tickets.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Null sender_id means system message
    sender_id = Column(
        UUID(as_uuid=True),
        ForeignKey("app_users.id", ondelete="SET NULL"),
        nullable=True
    )
    
    is_admin = Column(Boolean, default=False, nullable=False)
    message = Column(Text, nullable=False)
    
    # Attachments can be added later (JSON list of URLs)
    attachments = Column(Text, nullable=True)

    # Relationships
    ticket = relationship("SupportTicket", back_populates="messages")
    sender = relationship(User, lazy="joined")
