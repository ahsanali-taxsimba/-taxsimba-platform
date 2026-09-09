export const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'assignment': return '👤';
    case 'draft_ready': return '📄';
    case 'completion': return '✅';
    case 'document_request': return '📋';
    case 'communication': return '💬';
    case 'admin_flag': return '🚩';
    case 'review': return '⭐';
    case 'payment': return '💳';
    default: return '📢';
  }
};