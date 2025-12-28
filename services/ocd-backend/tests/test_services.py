"""
Unit Tests for Core Services
BSM, Greeks, and Reversal calculations
"""
import pytest
import math
from app.services.bsm import BSMService
from app.services.greeks import GreeksService
from app.services.reversal import ReversalService


class TestBSMService:
    """Test Black-Scholes Model calculations"""
    
    @pytest.fixture
    def bsm(self):
        return BSMService(risk_free_rate=0.10)
    
    def test_call_price_atm(self, bsm):
        """ATM call should have positive value"""
        price = bsm.price(S=24500, K=24500, T=0.1, sigma=0.15, option_type="call")
        assert price > 0
        assert price < 24500  # Should not exceed spot
    
    def test_put_price_atm(self, bsm):
        """ATM put should have positive value"""
        price = bsm.price(S=24500, K=24500, T=0.1, sigma=0.15, option_type="put")
        assert price > 0
        assert price < 24500
    
    def test_call_price_increases_with_spot(self, bsm):
        """Call price should increase as spot increases"""
        price_low = bsm.price(S=24000, K=24500, T=0.1, sigma=0.15, option_type="call")
        price_high = bsm.price(S=25000, K=24500, T=0.1, sigma=0.15, option_type="call")
        assert price_high > price_low
    
    def test_put_price_decreases_with_spot(self, bsm):
        """Put price should decrease as spot increases"""
        price_low = bsm.price(S=24000, K=24500, T=0.1, sigma=0.15, option_type="put")
        price_high = bsm.price(S=25000, K=24500, T=0.1, sigma=0.15, option_type="put")
        assert price_low > price_high
    
    def test_zero_time_to_expiry(self, bsm):
        """At expiry, option should be intrinsic value"""
        # ITM call
        price = bsm.price(S=25000, K=24500, T=0.0001, sigma=0.15, option_type="call")
        assert price >= 400  # Intrinsic ~500
    
    def test_implied_volatility_round_trip(self, bsm):
        """IV calculation should be reversible"""
        original_sigma = 0.20
        price = bsm.price(S=24500, K=24500, T=0.1, sigma=original_sigma, option_type="call")
        calculated_iv = bsm.implied_volatility(price, S=24500, K=24500, T=0.1, option_type="call")
        assert abs(calculated_iv - original_sigma) < 0.01  # Within 1%


class TestGreeksService:
    """Test Greeks calculations"""
    
    @pytest.fixture
    def greeks(self):
        return GreeksService(risk_free_rate=0.10)
    
    def test_call_delta_range(self, greeks):
        """Call delta should be between 0 and 1"""
        result = greeks.calculate_all_greeks(S=24500, K=24500, T=0.1, sigma=0.15, option_type="call")
        assert 0 <= result.delta <= 1
    
    def test_put_delta_range(self, greeks):
        """Put delta should be between -1 and 0"""
        result = greeks.calculate_all_greeks(S=24500, K=24500, T=0.1, sigma=0.15, option_type="put")
        assert -1 <= result.delta <= 0
    
    def test_atm_delta_approximately_half(self, greeks):
        """ATM call delta should be approximately 0.5"""
        result = greeks.calculate_all_greeks(S=24500, K=24500, T=0.1, sigma=0.15, option_type="call")
        assert 0.4 <= result.delta <= 0.7
    
    def test_gamma_positive(self, greeks):
        """Gamma should always be positive"""
        result = greeks.calculate_all_greeks(S=24500, K=24500, T=0.1, sigma=0.15, option_type="call")
        assert result.gamma >= 0
    
    def test_theta_negative_for_long(self, greeks):
        """Theta should be negative (time decay)"""
        result = greeks.calculate_all_greeks(S=24500, K=24500, T=0.1, sigma=0.15, option_type="call")
        assert result.theta <= 0
    
    def test_vega_positive(self, greeks):
        """Vega should be positive"""
        result = greeks.calculate_all_greeks(S=24500, K=24500, T=0.1, sigma=0.15, option_type="call")
        assert result.vega >= 0
    
    def test_all_greeks_returned(self, greeks):
        """Should return all 12 Greeks"""
        result = greeks.calculate_all_greeks(S=24500, K=24500, T=0.1, sigma=0.15, option_type="call")
        assert hasattr(result, 'delta')
        assert hasattr(result, 'gamma')
        assert hasattr(result, 'theta')
        assert hasattr(result, 'vega')
        assert hasattr(result, 'rho')
        assert hasattr(result, 'vanna')
        assert hasattr(result, 'vomma')
        assert hasattr(result, 'charm')
        assert hasattr(result, 'speed')
        assert hasattr(result, 'zomma')
        assert hasattr(result, 'color')
        assert hasattr(result, 'ultima')


class TestReversalService:
    """Test Reversal point calculations"""
    
    @pytest.fixture
    def reversal(self):
        return ReversalService(risk_free_rate=0.10)
    
    def test_reversal_returns_result(self, reversal):
        """calculate_reversal should return ReversalResult"""
        result = reversal.calculate_reversal(
            spot=24500,
            spot_change=10,
            iv_change=0.01,
            strike=24500,
            T_days=7,
            sigma_call=15,
            sigma_put=16,
            curr_call_price=200,
            curr_put_price=220
        )
        assert result is not None
        assert result.reversal > 0
        assert result.strike_price == 24500
    
    def test_reversal_confidence_range(self, reversal):
        """Confidence should be 0-100"""
        result = reversal.calculate_reversal(
            spot=24500,
            spot_change=10,
            iv_change=0.01,
            strike=24500,
            T_days=7,
            sigma_call=15,
            sigma_put=16,
            curr_call_price=200,
            curr_put_price=220
        )
        assert 0 <= result.confidence <= 100
    
    def test_trading_signals_valid(self, reversal):
        """Trading signals should have valid values"""
        result = reversal.calculate_reversal(
            spot=24500,
            spot_change=10,
            iv_change=0.01,
            strike=24500,
            T_days=7,
            sigma_call=15,
            sigma_put=16,
            curr_call_price=200,
            curr_put_price=220
        )
        assert result.trading_signals.entry > 0
        assert result.trading_signals.stop_loss < result.trading_signals.entry
        assert result.trading_signals.take_profit > result.trading_signals.entry
    
    def test_market_regimes_returned(self, reversal):
        """Market regimes should be present"""
        result = reversal.calculate_reversal(
            spot=24500,
            spot_change=10,
            iv_change=0.01,
            strike=24500,
            T_days=7,
            sigma_call=15,
            sigma_put=16,
            curr_call_price=200,
            curr_put_price=220
        )
        assert "volatility" in result.market_regimes
        assert "trend" in result.market_regimes
        assert "liquidity" in result.market_regimes
    
    def test_volatility_regime_detection(self, reversal):
        """Volatility regime detection"""
        high_vol = reversal.detect_volatility_regime([0.35, 0.40])
        low_vol = reversal.detect_volatility_regime([0.08, 0.10])
        assert high_vol == "high"
        assert low_vol == "low"
    
    def test_weekly_theta_decay(self, reversal):
        """Weekly theta decay should be positive"""
        decay_near = reversal.weekly_theta_decay(T_days=3)
        decay_far = reversal.weekly_theta_decay(T_days=30)
        assert decay_near > decay_far  # Higher decay near expiry


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
