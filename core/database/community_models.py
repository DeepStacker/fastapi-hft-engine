"""
Community Module Database Models

Production-grade models for trader-first community system:
- Rooms: Structured discussion channels
- Posts: Threaded discussions with trade breakdowns
- Reactions: Signal reactions and votes
- Reputation: User credibility tracking
- Signal Threads: Auto-linked signal discussions
- Feature Requests: Voting system for platform improvements
"""
from sqlalchemy import (
    Column, Integer, String, Float, BigInteger, Boolean, 
    DateTime, Text, JSON, ForeignKey, Index, CheckConstraint, 
    Enum, UniqueConstraint, desc
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
from uuid import uuid4
import enum

from core.database.db import Base


# ═══════════════════════════════════════════════════════════════════════════════
# ENUMS
# ═══════════════════════════════════════════════════════════════════════════════

class RoomType(str, enum.Enum):
    """Types of community rooms with different permissions"""
    MARKET_OUTLOOK = "market_outlook"       # Read-only for users, admins/analysts post
    SIGNAL_DISCUSSION = "signal_discussion" # Auto-created threads for signals
    TRADE_BREAKDOWN = "trade_breakdown"     # Completed trade analysis only
    STRATEGY_INSIGHTS = "strategy_insights" # Analysis-only, no live calls
    FEEDBACK = "feedback"                   # Bug reports, feature requests


class ReactionType(str, enum.Enum):
    """Types of reactions for posts and signals"""
    UPVOTE = "upvote"
    DOWNVOTE = "downvote"
    CONFIRM = "confirm"     # Signal confirmation
    DISAGREE = "disagree"   # Signal disagreement
    NEUTRAL = "neutral"     # Neutral stance


class TradeType(str, enum.Enum):
    """Types of trades for trade breakdown posts"""
    CE = "CE"       # Call option
    PE = "PE"       # Put option
    FUT = "FUT"     # Futures


class TradeReason(str, enum.Enum):
    """Predefined reasons for trade entry"""
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


class SignalOutcome(str, enum.Enum):
    """Outcome of a signal after expiry"""
    PENDING = "pending"
    WIN = "win"
    LOSS = "loss"
    NEUTRAL = "neutral"


class FeatureStatus(str, enum.Enum):
    """Status of feature requests"""
    OPEN = "open"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DECLINED = "declined"


class CommunityRole(str, enum.Enum):
    """Community-specific roles (extends base user roles)"""
    USER = "user"
    VERIFIED_TRADER = "verified_trader"
    ANALYST = "analyst"
    ADMIN = "admin"


# ═══════════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class CommunityRoomDB(Base):
    """
    Community Room - Structured channel for specific discussion types.
    
    Each room has strict permissions and posting rules to maintain quality.
    """
    __tablename__ = "community_rooms"
    
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(50), unique=True, nullable=False, index=True)  # URL-friendly identifier
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    room_type = Column(Enum(RoomType), nullable=False, index=True)
    
    # Permissions
    is_read_only = Column(Boolean, default=False, nullable=False)
    min_reputation_to_post = Column(Integer, default=0, nullable=False)
    post_cooldown_seconds = Column(Integer, default=60, nullable=False)
    allowed_roles = Column(ARRAY(String), default=["user"], nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    posts = relationship("CommunityPostDB", back_populates="room", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_community_rooms_active_type', 'is_active', 'room_type'),
    )
    
    def __repr__(self):
        return f"<CommunityRoom(slug={self.slug}, type={self.room_type})>"


class CommunityPostDB(Base):
    """
    Community Post - Threaded discussion posts with optional trade breakdown.
    
    Supports:
    - Regular text posts
    - Trade breakdown posts (structured trade analysis)
    - Signal-linked discussions (auto-created)
    """
    __tablename__ = "community_posts"
    
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey('community_rooms.id', ondelete='CASCADE'), nullable=False, index=True)
    parent_post_id = Column(Integer, ForeignKey('community_posts.id', ondelete='SET NULL'), nullable=True, index=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey('app_users.id', ondelete='CASCADE'), nullable=False, index=True)
    signal_id = Column(Integer, nullable=True, index=True)  # Foreign key to signals table (if exists)
    
    # Content
    title = Column(String(200), nullable=True)
    content = Column(Text, nullable=False)
    content_type = Column(String(20), default='text', nullable=False)  # 'text', 'trade_breakdown', 'analysis'
    
    # Trade Breakdown Fields (only for trade_breakdown room)
    instrument = Column(String(50), nullable=True)
    entry_price = Column(Float, nullable=True)
    exit_price = Column(Float, nullable=True)
    trade_type = Column(Enum(TradeType), nullable=True)
    trade_reason = Column(Enum(TradeReason), nullable=True)
    trade_explanation = Column(Text, nullable=True)
    screenshot_url = Column(Text, nullable=True)
    
    # Status flags
    is_pinned = Column(Boolean, default=False, nullable=False)
    is_edited = Column(Boolean, default=False, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    
    # Denormalized aggregates (for performance)
    upvotes = Column(Integer, default=0, nullable=False)
    downvotes = Column(Integer, default=0, nullable=False)
    reply_count = Column(Integer, default=0, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    room = relationship("CommunityRoomDB", back_populates="posts")
    author = relationship("AppUserDB", backref="community_posts")
    replies = relationship("CommunityPostDB", backref="parent_post", remote_side=[id])
    reactions = relationship("CommunityReactionDB", back_populates="post", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_community_posts_room_created', 'room_id', desc('created_at')),
        Index('idx_community_posts_author', 'author_id', 'created_at'),
        Index('idx_community_posts_signal', 'signal_id'),
        Index('idx_community_posts_pinned', 'room_id', 'is_pinned', 'created_at'),
        CheckConstraint('upvotes >= 0', name='chk_upvotes_nonneg'),
        CheckConstraint('downvotes >= 0', name='chk_downvotes_nonneg'),
    )
    
    def __repr__(self):
        return f"<CommunityPost(id={self.id}, room_id={self.room_id}, author_id={self.author_id})>"
    
    @property
    def net_votes(self) -> int:
        return self.upvotes - self.downvotes


class CommunityReactionDB(Base):
    """
    Reaction to a post or signal.
    
    One reaction per user per post (upsert semantics).
    """
    __tablename__ = "community_reactions"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey('community_posts.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('app_users.id', ondelete='CASCADE'), nullable=False, index=True)
    reaction_type = Column(Enum(ReactionType), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    post = relationship("CommunityPostDB", back_populates="reactions")
    user = relationship("AppUserDB", backref="community_reactions")
    
    __table_args__ = (
        UniqueConstraint('post_id', 'user_id', name='uq_reaction_post_user'),
        Index('idx_reaction_post_type', 'post_id', 'reaction_type'),
    )
    
    def __repr__(self):
        return f"<CommunityReaction(post_id={self.post_id}, user_id={self.user_id}, type={self.reaction_type})>"


class UserReputationDB(Base):
    """
    User Reputation - Tracks credibility and trading performance.
    
    Influences:
    - Posting permissions
    - Cooldown requirements
    - Badge/status display
    """
    __tablename__ = "user_reputation"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey('app_users.id', ondelete='CASCADE'), primary_key=True)
    
    # Core reputation
    reputation_score = Column(Integer, default=0, nullable=False, index=True)
    helpful_votes = Column(Integer, default=0, nullable=False)
    
    # Trading performance
    trade_accuracy = Column(Float, default=0.0, nullable=False)  # Percentage 0-100
    total_trades_shared = Column(Integer, default=0, nullable=False)
    winning_trades = Column(Integer, default=0, nullable=False)
    losing_trades = Column(Integer, default=0, nullable=False)
    
    # Verification status
    verified_trader = Column(Boolean, default=False, nullable=False, index=True)
    community_role = Column(Enum(CommunityRole), default=CommunityRole.USER, nullable=False)
    
    # Cooldown/restrictions
    posting_cooldown_until = Column(DateTime, nullable=True)
    consecutive_losses = Column(Integer, default=0, nullable=False)
    last_post_at = Column(DateTime, nullable=True)
    is_muted = Column(Boolean, default=False, nullable=False)
    muted_until = Column(DateTime, nullable=True)
    
    # Timestamps
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("AppUserDB", backref="reputation")
    
    __table_args__ = (
        Index('idx_reputation_score', desc('reputation_score')),
        Index('idx_reputation_verified', 'verified_trader', desc('reputation_score')),
    )
    
    def __repr__(self):
        return f"<UserReputation(user_id={self.user_id}, score={self.reputation_score})>"
    
    def calculate_score(self) -> int:
        """Calculate reputation score based on multiple factors"""
        score = (
            self.helpful_votes * 2 +
            int(self.trade_accuracy * 0.5) +
            self.total_trades_shared * 5 +
            self.winning_trades * 10 -
            self.losing_trades * 5
        )
        return max(0, score)


class SignalThreadDB(Base):
    """
    Signal Discussion Thread - Auto-created for each signal.
    
    Links signals to community discussions with:
    - Market snapshot at signal time
    - Aggregated reactions
    - Outcome tracking
    """
    __tablename__ = "signal_threads"
    
    signal_id = Column(Integer, primary_key=True, index=True)  # Reference to signals table
    post_id = Column(Integer, ForeignKey('community_posts.id', ondelete='SET NULL'), nullable=True, index=True)
    
    # Market context at signal time
    market_snapshot = Column(JSON, nullable=True)  # OI, IV, Greeks, spot price, etc.
    
    # Outcome tracking
    outcome = Column(Enum(SignalOutcome), default=SignalOutcome.PENDING, nullable=False, index=True)
    outcome_pnl = Column(Float, nullable=True)  # Realized P&L
    
    # Aggregated reactions
    bullish_reactions = Column(Integer, default=0, nullable=False)
    bearish_reactions = Column(Integer, default=0, nullable=False)
    neutral_reactions = Column(Integer, default=0, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)  # When outcome was determined
    
    # Relationships
    post = relationship("CommunityPostDB", backref="signal_thread")
    
    __table_args__ = (
        Index('idx_signal_thread_outcome', 'outcome', 'created_at'),
    )
    
    def __repr__(self):
        return f"<SignalThread(signal_id={self.signal_id}, outcome={self.outcome})>"
    
    @property
    def total_reactions(self) -> int:
        return self.bullish_reactions + self.bearish_reactions + self.neutral_reactions
    
    @property
    def sentiment_ratio(self) -> float:
        """Bullish/bearish ratio (>1 = bullish, <1 = bearish)"""
        if self.bearish_reactions == 0:
            return float('inf') if self.bullish_reactions > 0 else 1.0
        return self.bullish_reactions / self.bearish_reactions


class FeatureRequestDB(Base):
    """
    Feature Request - User suggestions with voting system.
    
    Allows community to prioritize platform improvements.
    """
    __tablename__ = "feature_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey('app_users.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Content
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=True)  # UI, Backend, Analytics, etc.
    
    # Status
    status = Column(Enum(FeatureStatus), default=FeatureStatus.OPEN, nullable=False, index=True)
    admin_response = Column(Text, nullable=True)
    
    # Voting
    vote_count = Column(Integer, default=0, nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    author = relationship("AppUserDB", backref="feature_requests")
    votes = relationship("FeatureVoteDB", back_populates="feature_request", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_feature_status_votes', 'status', desc('vote_count')),
    )
    
    def __repr__(self):
        return f"<FeatureRequest(id={self.id}, title={self.title[:30]}...)>"


class FeatureVoteDB(Base):
    """
    Vote on a feature request.
    
    One vote per user per feature (upsert semantics).
    """
    __tablename__ = "feature_votes"
    
    id = Column(Integer, primary_key=True, index=True)
    feature_request_id = Column(Integer, ForeignKey('feature_requests.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('app_users.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    feature_request = relationship("FeatureRequestDB", back_populates="votes")
    user = relationship("AppUserDB", backref="feature_votes")
    
    __table_args__ = (
        UniqueConstraint('feature_request_id', 'user_id', name='uq_feature_vote_user'),
    )
    
    def __repr__(self):
        return f"<FeatureVote(feature_id={self.feature_request_id}, user_id={self.user_id})>"
