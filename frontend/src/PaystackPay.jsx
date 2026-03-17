import { PaystackButton } from "react-paystack";

function PaystackPay({ email, amount, reference, disabled, className, onSuccess }) {
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
  const currency = import.meta.env.VITE_PAYSTACK_CURRENCY || "KES";

  const config = {
    reference,
    email: email,
    amount: amount * 100, // Paystack uses kobo (multiply by 100)
    publicKey,
    currency
  };

  const handleSuccess = (reference) => {
    alert("Payment successful!");
    onSuccess(reference);
  };

  const handleClose = () => {
    alert("Payment cancelled");
  };

  return (
    <PaystackButton
      {...config}
      text="Pay with Paystack"
      className={className}
      disabled={disabled || !publicKey}
      onSuccess={handleSuccess}
      onClose={handleClose}
    />
  );
}

export default PaystackPay;
