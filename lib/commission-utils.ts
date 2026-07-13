export type DriverFees = {
  fee_up_to_10: number;
  fee_up_to_20: number;
  fee_up_to_30: number;
  fee_up_to_40: number;
  fee_up_to_50: number;
  fee_up_to_100: number;
  fee_up_to_200: number;
  fee_up_to_300: number;
  fee_up_to_400: number;
  fee_up_to_500: number;
};

export const calculateDeliveryFee = (totalAmount: number, driverFees?: DriverFees): number => {
  if (!driverFees) {
    return 0;
  }

  if (totalAmount <= 10) return driverFees.fee_up_to_10;
  if (totalAmount <= 20) return driverFees.fee_up_to_20;
  if (totalAmount <= 30) return driverFees.fee_up_to_30;
  if (totalAmount <= 40) return driverFees.fee_up_to_40;
  if (totalAmount <= 50) return driverFees.fee_up_to_50;
  if (totalAmount <= 100) return driverFees.fee_up_to_100;
  if (totalAmount <= 200) return driverFees.fee_up_to_200;
  if (totalAmount <= 300) return driverFees.fee_up_to_300;
  if (totalAmount <= 400) return driverFees.fee_up_to_400;
  if (totalAmount <= 500) return driverFees.fee_up_to_500;
  return driverFees.fee_up_to_500;
};

export const getCommissionTier = (totalAmount: number): string => {
  if (totalAmount <= 10) return 'Up to $10';
  if (totalAmount <= 20) return '$10 - $20';
  if (totalAmount <= 30) return '$20 - $30';
  if (totalAmount <= 40) return '$30 - $40';
  if (totalAmount <= 50) return '$40 - $50';
  if (totalAmount <= 100) return '$50 - $100';
  if (totalAmount <= 200) return '$100 - $200';
  if (totalAmount <= 300) return '$200 - $300';
  if (totalAmount <= 400) return '$300 - $400';
  if (totalAmount <= 500) return '$400 - $500';
  return 'Over $500';
};

export const formatCommissionBreakdown = (driverFees: DriverFees): string => {
  return `Up to $10: $${driverFees.fee_up_to_10.toFixed(2)} • $10-$20: $${driverFees.fee_up_to_20.toFixed(2)} • $20-$30: $${driverFees.fee_up_to_30.toFixed(2)} • $30-$40: $${driverFees.fee_up_to_40.toFixed(2)} • $40-$50: $${driverFees.fee_up_to_50.toFixed(2)}`;
};
