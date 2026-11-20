import { forwardRef, useCallback, useRef, type ForwardRefExoticComponent, type RefAttributes } from 'react';
import { TextInput as NativeTextInput, TextInputProps } from 'react-native';
import { State, TextInput as GestureTextInput, type NativeViewGestureHandlerProps } from 'react-native-gesture-handler';

// Gesture Handler forwards the native instance; its v2 ref declaration instead
// describes the component type. Keep the public ref contract as TextInput.
const NativeGestureTextInput = GestureTextInput as unknown as ForwardRefExoticComponent<
  TextInputProps & NativeViewGestureHandlerProps & RefAttributes<NativeTextInput>
>;

/** Let Android's native gesture pipeline focus fields inside scrollable forms. */
export default forwardRef<NativeTextInput, TextInputProps>(function AuthTextInput(props, forwardedRef) {
  const input = useRef<NativeTextInput | null>(null);
  const attach = useCallback((instance: NativeTextInput | null) => {
    input.current = instance;
    if (typeof forwardedRef === 'function') forwardedRef(instance);
    else if (forwardedRef) forwardedRef.current = instance;
  }, [forwardedRef]);

  return <NativeGestureTextInput {...props} ref={attach} shouldActivateOnStart
    showSoftInputOnFocus={props.showSoftInputOnFocus ?? true}
    caretHidden={props.caretHidden ?? false}
    cursorColor={props.cursorColor ?? props.selectionColor ?? '#1A73E8'}
    style={[{ minHeight: 44, minWidth: 0 }, props.style]}
    onHandlerStateChange={event => {
      // A completed tap focuses explicitly; cancelled scroll gestures do not.
      if (event.nativeEvent.state === State.END && props.editable !== false && !input.current?.isFocused()) {
        input.current?.focus();
      }
    }}
  />;
});
