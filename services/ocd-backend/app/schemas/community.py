"""
Community Module Pydantic Schemas

API input/output schemas for the community module.
Following RESTful patterns with Create/Update/Response variants.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, field_validator
from enum import Enum


# ═══════════════════════════════════════════════════════════════════════════════
# ENUMS (mirroring database enums for API layer)
# ═══════════════════════════════════════════════════════════════════════════════

class RoomType(str, Enum):
    MARKET_OUTLOOK = "market_outlook"
    SIGNAL_DISCUSSION = "signal_discussion"
    TRADE_BREAKDOWN = "trade_breakdown"
    STRATEGY_INSIGHTS = "strategy_insights"
    FEEDBACK = "feedback"


class ReactionType(str, Enum):
    UPVOTE = "upvote"
    DOWNVOTE = "downvote"
    CONFIRM = "confirm"
    DISAGREE = "disagree"
    NEUTRAL = "neutral"


class TradeType(str, Enum):
    CE = "CE"
    PE = "PE"
    FUT = "FUT"


class TradeReason(str, Enum):
    OI_BUILDUP = "oi_buildup"
    OI_UNWINDING = "oi_unwinding"
    PCR_SHIFT = "pcr_shift"
    IV_CHANGE = "iv_change"
    SUPPORT_RESISTANCE = "support_resistance"
    PATTERN_BREAKOUT = "pattern_breakout"
    REVERSAL_SIGNAL = "reversal_signal"
    NEWS_EVENT = "news_event"
    HEDGING = "hedging"
    OTHER = "other"


class SignalOutcome(str, Enum):
    PENDING = "pending"
    WIN = "win"
    LOSS = "loss"
    NEUTRAL = "neutral"


class FeatureStatus(str, Enum):
    OPEN = "open"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DECLINED = "declined"


class CommunityRole(str, Enum):
    USER = "user"
    VERIFIED_TRADER = "verified_trader"
    ANALYST = "analyst"
    ADMIN = "admin"


# ═══════════════════════════════════════════════════════════════════════════════
# ROOM SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class CommunityRoomBase(BaseModel):
    slug: str = Field(..., min_length=2, max_length=50, pattern=r"^[a-z0-9-]+$")
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    room_type: RoomType
    is_read_only: bool = False
    min_reputation_to_post: int = 0
    post_cooldown_seconds: int = 60
    allowed_roles: List[str] = ["user"]


class CommunityRoomCreate(CommunityRoomBase):
    """Schema for creating a new room (admin only)"""
    pass


class CommunityRoomUpdate(BaseModel):
    """Schema for updating a room (admin only)"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    is_read_only: Optional[bool] = None
    min_reputation_to_post: Optional[int] = None
    post_cooldown_seconds: Optional[int] = None
    allowed_roles: Optional[List[str]] = None
    is_active: Optional[bool] = None


class CommunityRoomResponse(CommunityRoomBase):
    """Schema for room API responses"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    is_active: bool
    created_at: datetime
    post_count: Optional[int] = 0  # Computed field


class CommunityRoomListResponse(BaseModel):
    """Paginated list of rooms"""
    rooms: List[CommunityRoomResponse]
    total: int


# ═══════════════════════════════════════════════════════════════════════════════
# POST SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class CommunityPostBase(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    content: str = Field(..., min_length=1, max_length=10000)


class CommunityPostCreate(CommunityPostBase):
    """Schema for creating a new post"""
    parent_post_id: Optional[int] = None  # For replies
    
    # Trade breakdown fields (optional, required for trade_breakdown room)
    instrument: Optional[str] = Field(None, max_length=50)
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    trade_type: Optional[TradeType] = None
    trade_reason: Optional[TradeReason] = None
    trade_explanation: Optional[str] = None
    screenshot_url: Optional[str] = Field(None, max_length=500)
    
    @field_validator('content')
    @classmethod
    def validate_content(cls, v: str) -> str:
        """Basic content validation"""
        if not v or not v.strip():
            raise ValueError('Content cannot be empty')
        return v.strip()


class CommunityPostUpdate(BaseModel):
    """Schema for updating a post (author only)"""
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = Field(None, min_length=1, max_length=10000)
    trade_explanation: Optional[str] = None


class AuthorInfo(BaseModel):
    """Embedded author information"""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    username: str
    profile_image: Optional[str] = None
    reputation_score: int = 0
    verified_trader: bool = False
    community_role: CommunityRole = CommunityRole.USER


class CommunityPostResponse(CommunityPostBase):
    """Schema for post API responses"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    room_id: int
    parent_post_id: Optional[int] = None
    author_id: UUID
    signal_id: Optional[int] = None
    
    # Trade breakdown fields
    instrument: Optional[str] = None
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    trade_type: Optional[TradeType] = None
    trade_reason: Optional[TradeReason] = None
    trade_explanation: Optional[str] = None
    screenshot_url: Optional[str] = None
    
    # Status
    is_pinned: bool = False
    is_edited: bool = False
    
    # Aggregates
    upvotes: int = 0
    downvotes: int = 0
    reply_count: int = 0
    net_votes: int = 0
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    
    # Embedded author info (populated by service)
    author: Optional[AuthorInfo] = None
    
    # User's reaction (populated for authenticated requests)
    user_reaction: Optional[ReactionType] = None


class CommunityPostListResponse(BaseModel):
    """Paginated list of posts"""
    posts: List[CommunityPostResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class ThreadResponse(BaseModel):
    """Full thread with root post and replies"""
    post: CommunityPostResponse
    replies: List[CommunityPostResponse]
    total_replies: int


# ═══════════════════════════════════════════════════════════════════════════════
# REACTION SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class ReactionCreate(BaseModel):
    """Schema for adding/updating a reaction"""
    reaction_type: ReactionType


class ReactionResponse(BaseModel):
    """Schema for reaction API responses"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    post_id: int
    user_id: UUID
    reaction_type: ReactionType
    created_at: datetime


class ReactionSummary(BaseModel):
    """Aggregated reaction summary for a post"""
    upvotes: int = 0
    downvotes: int = 0
    confirms: int = 0
    disagrees: int = 0
    neutrals: int = 0
    total: int = 0


# ═══════════════════════════════════════════════════════════════════════════════
# REPUTATION SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class UserReputationResponse(BaseModel):
    """Schema for reputation API responses"""
    model_config = ConfigDict(from_attributes=True)
    
    user_id: UUID
    reputation_score: int = 0
    helpful_votes: int = 0
    trade_accuracy: float = 0.0
    total_trades_shared: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    verified_trader: bool = False
    community_role: CommunityRole = CommunityRole.USER
    is_muted: bool = False
    
    # Computed fields
    win_rate: Optional[float] = None
    rank: Optional[int] = None  # Leaderboard position


class LeaderboardEntry(BaseModel):
    """Entry in the reputation leaderboard"""
    rank: int
    user_id: UUID
    username: str
    profile_image: Optional[str] = None
    reputation_score: int
    trade_accuracy: float
    verified_trader: bool


class LeaderboardResponse(BaseModel):
    """Leaderboard API response"""
    entries: List[LeaderboardEntry]
    total_users: int
    user_rank: Optional[int] = None  # Current user's rank


# ═══════════════════════════════════════════════════════════════════════════════
# SIGNAL THREAD SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class SignalThreadResponse(BaseModel):
    """Schema for signal thread API responses"""
    model_config = ConfigDict(from_attributes=True)
    
    signal_id: int
    post_id: Optional[int] = None
    market_snapshot: Optional[Dict[str, Any]] = None
    outcome: SignalOutcome = SignalOutcome.PENDING
    outcome_pnl: Optional[float] = None
    bullish_reactions: int = 0
    bearish_reactions: int = 0
    neutral_reactions: int = 0
    total_reactions: int = 0
    sentiment_ratio: float = 1.0
    created_at: datetime
    resolved_at: Optional[datetime] = None
    
    # Thread discussion (if linked)
    post: Optional[CommunityPostResponse] = None
    reply_count: int = 0


class SignalReactionCreate(BaseModel):
    """Schema for reacting to a signal"""
    sentiment: str = Field(..., pattern=r"^(bullish|bearish|neutral)$")


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE REQUEST SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class FeatureRequestCreate(BaseModel):
    """Schema for creating a feature request"""
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=20, max_length=5000)
    category: Optional[str] = Field(None, max_length=50)


class FeatureRequestUpdate(BaseModel):
    """Schema for updating a feature request (admin)"""
    status: Optional[FeatureStatus] = None
    admin_response: Optional[str] = Field(None, max_length=2000)


class FeatureRequestResponse(BaseModel):
    """Schema for feature request API responses"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    author_id: UUID
    title: str
    description: str
    category: Optional[str] = None
    status: FeatureStatus = FeatureStatus.OPEN
    admin_response: Optional[str] = None
    vote_count: int = 0
    created_at: datetime
    updated_at: datetime
    
    # Embedded author info
    author: Optional[AuthorInfo] = None
    
    # Whether current user has voted
    user_voted: bool = False


class FeatureRequestListResponse(BaseModel):
    """Paginated list of feature requests"""
    requests: List[FeatureRequestResponse]
    total: int
    page: int
    page_size: int


# ═══════════════════════════════════════════════════════════════════════════════
# MODERATION SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class MuteUserRequest(BaseModel):
    """Schema for muting a user"""
    duration_hours: int = Field(..., ge=1, le=8760)  # Max 1 year
    reason: str = Field(..., min_length=10, max_length=500)


class PinPostRequest(BaseModel):
    """Schema for pinning/unpinning a post"""
    is_pinned: bool


class ModerationAction(BaseModel):
    """Record of a moderation action"""
    action: str  # 'pin', 'unpin', 'delete', 'mute', 'unmute'
    target_type: str  # 'post', 'user'
    target_id: str
    moderator_id: UUID
    reason: Optional[str] = None
    timestamp: datetime


class ModerationQueueItem(BaseModel):
    """Item in the moderation queue"""
    post: CommunityPostResponse
    reports_count: int = 0
    flags: List[str] = []  # 'spam', 'offensive', 'live_call', etc.


class ModerationQueueResponse(BaseModel):
    """Moderation queue API response"""
    items: List[ModerationQueueItem]
    total: int


# ═══════════════════════════════════════════════════════════════════════════════
# SENTIMENT & ANALYTICS SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class CommunitySentiment(BaseModel):
    """Aggregated community sentiment"""
    bullish_count: int = 0
    bearish_count: int = 0
    neutral_count: int = 0
    total_participants: int = 0
    confidence_score: float = 0.0  # Based on participation quality
    dominant_sentiment: str = "neutral"  # 'bullish', 'bearish', 'neutral'
    timestamp: datetime


class CommunityStats(BaseModel):
    """Community-wide statistics"""
    total_members: int = 0
    active_today: int = 0
    posts_today: int = 0
    top_contributors: List[LeaderboardEntry] = []
    recent_signals: List[SignalThreadResponse] = []
