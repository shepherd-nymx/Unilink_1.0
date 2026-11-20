import { forwardRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView as NativeScrollView, ScrollViewProps } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

export default forwardRef<NativeScrollView, ScrollViewProps>(function AuthScrollView(props, ref) {
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView {...props} ref={ref} style={[{ flex: 1 }, props.style]}
      contentContainerStyle={[{ flexGrow: 1 }, props.contentContainerStyle]}
      keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? 'handled'}
      removeClippedSubviews={false}
    />
  </KeyboardAvoidingView>;
});
