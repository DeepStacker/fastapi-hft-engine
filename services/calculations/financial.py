"""
Financial Calculators

Lumpsum, SIP, SWP, and other financial calculations.
"""

import math
from typing import Dict


class FinancialCalculators:
    """
    Collection of financial calculators
    """
    
    @staticmethod
    def lumpsum(
        principal: float,
        annual_rate: float,
        time_years: float
    ) -> Dict[str, float]:
        """
        Lumpsum investment calculator
        
        Args:
            principal: Initial investment amount
            annual_rate: Annual interest rate (decimal, e.g., 0.12 = 12%)
            time_years: Investment period in years
        
        Returns:
            Dict with future_value, interest_earned, total_return_pct
        """
        future_value = principal * math.pow((1 + annual_rate), time_years)
        interest_earned = future_value - principal
        total_return_pct = (interest_earned / principal) * 100
        
        return {
            "principal": round(principal, 2),
            "future_value": round(future_value, 2),
            "interest_earned": round(interest_earned, 2),
            "total_return_pct": round(total_return_pct, 2),
            "annual_rate": annual_rate,
            "time_years": time_years
        }
    
    @staticmethod
    def sip(
        monthly_investment: float,
        annual_rate: float,
        time_years: float
    ) -> Dict[str, float]:
        """
        Systematic Investment Plan (SIP) calculator
        
        Args:
            monthly_investment: Monthly investment amount
            annual_rate: Expected annual return (decimal)
            time_years: Investment period in years
        
        Returns:
            Dict with invested_amount, future_value, wealth_gained
        """
        monthly_rate = annual_rate / 12
        total_months = int(time_years * 12)
        
        # Future value of annuity formula
        if monthly_rate == 0:
            future_value = monthly_investment * total_months
        else:
            future_value = monthly_investment * (
                (math.pow(1 + monthly_rate, total_months) - 1) / monthly_rate
            ) * (1 + monthly_rate)
        
        invested_amount = monthly_investment * total_months
        wealth_gained = future_value - invested_amount
        
        return {
            "monthly_investment": round(monthly_investment, 2),
            "invested_amount": round(invested_amount, 2),
            "future_value": round(future_value, 2),
            "wealth_gained": round(wealth_gained, 2),
            "total_return_pct": round((wealth_gained / invested_amount) * 100, 2),
            "annual_rate": annual_rate,
            "time_years": time_years,
            "total_months": total_months
        }
    
    @staticmethod
    def swp(
        corpus: float,
        withdrawal_per_month: float,
        annual_rate: float,
        time_years: float
    ) -> Dict[str, float]:
        """
        Systematic Withdrawal Plan (SWP) calculator
        
        Args:
            corpus: Initial corpus amount
            withdrawal_per_month: Monthly withdrawal amount
            annual_rate: Expected annual return (decimal)
            time_years: Withdrawal period in years
        
        Returns:
            Dict with remaining_corpus, total_withdrawn, corpus_exhaustion_months
        """
        monthly_rate = annual_rate / 12
        total_months = int(time_years * 12)
        
        remaining_corpus = corpus
        total_withdrawn = 0
        exhaustion_month = None
        
        for month in range(1, total_months + 1):
            # Add monthly return
            remaining_corpus = remaining_corpus * (1 + monthly_rate)
            
            # Withdraw
            if remaining_corpus >= withdrawal_per_month:
                remaining_corpus -= withdrawal_per_month
                total_withdrawn += withdrawal_per_month
            else:
                # Corpus exhausted
                total_withdrawn += remaining_corpus
                remaining_corpus = 0
                exhaustion_month = month
                break
        
        return {
            "initial_corpus": round(corpus, 2),
            "withdrawal_per_month": round(withdrawal_per_month, 2),
            "remaining_corpus": round(remaining_corpus, 2),
            "total_withdrawn": round(total_withdrawn, 2),
            "corpus_exhaustion_months": exhaustion_month,
            "corpus_exhausted": remaining_corpus == 0,
            "annual_rate": annual_rate,
            "time_years": time_years
        }
    
    @staticmethod
    def emi(
        loan_amount: float,
        annual_rate: float,
        tenure_months: int
    ) -> Dict[str, float]:
        """
        EMI (Equated Monthly Installment) calculator
        
        Args:
            loan_amount: Principal loan amount
            annual_rate: Annual interest rate (decimal)
            tenure_months: Loan tenure in months
        
        Returns:
            Dict with emi, total_payment, total_interest
        """
        monthly_rate = annual_rate / 12
        
        if monthly_rate == 0:
            emi = loan_amount / tenure_months
        else:
            emi = loan_amount * monthly_rate * math.pow(1 + monthly_rate, tenure_months) / \
                  (math.pow(1 + monthly_rate, tenure_months) - 1)
        
        total_payment = emi * tenure_months
        total_interest = total_payment - loan_amount
        
        return {
            "loan_amount": round(loan_amount, 2),
            "emi": round(emi, 2),
            "total_payment": round(total_payment, 2),
            "total_interest": round(total_interest, 2),
            "annual_rate": annual_rate,
            "tenure_months": tenure_months
        }
    
    @staticmethod
    def compound_interest(
        principal: float,
        annual_rate: float,
        time_years: float,
        frequency: int = 1
    ) -> Dict[str, float]:
        """
        Compound interest calculator
        
        Args:
            principal: Principal amount
            annual_rate: Annual interest rate (decimal)
            time_years: Time period in years
            frequency: Compounding frequency per year (1=annual, 4=quarterly, 12=monthly, 365=daily)
        
        Returns:
            Dict with amount, interest, effective_rate
        """
        amount = principal * math.pow(1 + annual_rate / frequency, frequency * time_years)
        interest = amount - principal
        effective_rate = (amount / principal) ** (1 / time_years) - 1 if time_years > 0 else 0
        
        return {
            "principal": round(principal, 2),
            "amount": round(amount, 2),
            "interest": round(interest, 2),
            "effective_annual_rate": round(effective_rate, 4),
            "annual_rate": annual_rate,
            "time_years": time_years,
            "compounding_frequency": frequency
        }
