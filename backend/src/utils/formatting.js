/**
 * Formats a delivery record into a compact reference object for analytics and recaps.
 *
 * @param {object} delivery
 * @returns {object} Formatted delivery reference
 */
export function formatDeliveryReference(delivery) {
  const ref = {
    deliveryId: delivery.id ?? delivery.deliveryId,
    inningsId: delivery.inningsId,
    deliverySequence: delivery.deliverySequence,
    display: {
      overNumber: delivery.displayOver ?? delivery.display?.overNumber,
      ballLabel: delivery.displayBallLabel ?? delivery.display?.ballLabel
    }
  };

  const inningsNumber = delivery.innings?.inningsNumber ?? delivery.inningsNumber;
  if (inningsNumber !== undefined) {
    ref.inningsNumber = inningsNumber;
  }

  return ref;
}
