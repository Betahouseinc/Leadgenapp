/** Format a number as Indian Rupees: ₹1,00,000 */
export const fd = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
