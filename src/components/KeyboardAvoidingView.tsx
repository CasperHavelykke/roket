import { Platform, KeyboardAvoidingView as RNKeyboardAvoidingView } from 'react-native';

const KeyboardAvoidingView = Platform.OS === 'android'
  ? require('react-native-keyboard-controller').KeyboardAvoidingView
  : RNKeyboardAvoidingView;

export default KeyboardAvoidingView;
