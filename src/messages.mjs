// All user-visible interface text lives here, so adding a locale later touches only this file.
const plural = (n, one, many) => (n === 1 ? one : many);

export const t = {
  barLabel: ' Holdback ',
  barCount: n => ` ${n} ${plural(n, 'message', 'messages')}`,
  barButton: ' Click to receive ⏎ ',
  barHint: ' Sent in order when focus leaves',
  barKeys: 'alt+i to view list ',
  listTitle: n => `Pending messages  ${n}`,
  listEmpty: '(No pending messages)',
  listMore: n => `…${n} more`,
  listSendHint: pane => `Enter: send all to ${pane}  Esc: not now`,
  listCloseHint: 'Esc: close',
  typingHint: ' Input box has text: send or clear it first ',
  notifyTitle: from => `Message from ${from}`,
};
