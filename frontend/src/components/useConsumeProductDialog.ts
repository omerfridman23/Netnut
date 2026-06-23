import { useState } from 'react';
import { useConsume, useCustomers, useProducts } from '../api/hooks';
import { getErrorMessage } from '../utils/error';

interface Options {
  /** Lock the dialog to a specific customer (from the detail page). */
  fixedCustomerId?: string;
  onClose: () => void;
}

/**
 * Owns all the state and behaviour for the "record consumption" dialog, keeping
 * `ConsumeProductDialog` a pure render. Loads the option lists, validates the
 * selection, estimates the cost, and fires an idempotent consume mutation.
 */
export function useConsumeProductDialog({ fixedCustomerId, onClose }: Options) {
  const productsQuery = useProducts();
  const customersQuery = useCustomers();
  const consume = useConsume();

  const [customerId, setCustomerId] = useState(fixedCustomerId ?? '');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');

  const customers = customersQuery.data?.data ?? [];
  const products = productsQuery.data ?? [];

  const selectedProduct = products.find((p) => p.id === productId);
  const qtyNum = Number.parseInt(quantity, 10);
  const qtyValid = Number.isInteger(qtyNum) && qtyNum > 0;
  const estimatedCost =
    selectedProduct && qtyValid ? selectedProduct.unitPrice * qtyNum : null;

  const effectiveCustomerId = fixedCustomerId ?? customerId;
  const canSubmit = Boolean(effectiveCustomerId) && Boolean(productId) && qtyValid;

  const handleClose = () => {
    consume.reset();
    if (!fixedCustomerId) setCustomerId('');
    setProductId('');
    setQuantity('1');
    onClose();
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    // One idempotency key per click: a double-click or network retry of this
    // exact action will reuse it, so the customer is charged at most once.
    consume.mutate(
      {
        customerId: effectiveCustomerId,
        productId,
        quantity: qtyNum,
        idempotencyKey: crypto.randomUUID(),
      },
      { onSuccess: handleClose },
    );
  };

  const errorMessage = consume.error
    ? getErrorMessage(consume.error, 'Something went wrong. Please try again.')
    : null;

  return {
    customers,
    products,
    customersLoading: customersQuery.isLoading,
    productsLoading: productsQuery.isLoading,
    customerId,
    setCustomerId,
    productId,
    setProductId,
    quantity,
    setQuantity,
    qtyValid,
    estimatedCost,
    canSubmit,
    isPending: consume.isPending,
    errorMessage,
    handleClose,
    handleSubmit,
  };
}
