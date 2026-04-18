import { StyleSheet } from 'react-native';
import { C } from '../../constants/colors';

export const goalSheetStyles = StyleSheet.create({
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: C.textSecondary,
    marginBottom: 18,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  helperText: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  input: {
    fontSize: 16,
    color: C.text,
    borderBottomWidth: 1.5,
    borderBottomColor: C.accent,
    paddingVertical: 10,
    marginBottom: 16,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceSecondary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segmentButtonActive: {
    borderColor: C.accent,
    backgroundColor: C.accentLight,
  },
  segmentText: {
    fontSize: 14,
    color: C.textSecondary,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: C.accent,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.surfaceSecondary,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    color: C.textSecondary,
    fontWeight: '500',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: 'center',
  },
  confirmDisabled: {
    opacity: 0.4,
  },
  confirmText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
});
