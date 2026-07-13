import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import LinearGradient, { LinearGradientProps } from 'react-native-linear-gradient';

type Props = LinearGradientProps & { children?: React.ReactNode };

/**
 * On iOS with New Architecture (Fabric), react-native-linear-gradient
 * does not render children correctly when used as a container.
 * Fix: use an absolute LinearGradient as background inside a plain View.
 * On Android the original LinearGradient works fine.
 */
const GradientView: React.FC<Props> = ({ style, children, ...gradientProps }) => {
  if (Platform.OS === 'ios') {
    // Kopier evt. borderRadius ned på selve LinearGradient. Ellers klippes
    // gradienten kun af det ydre View — og når react-native-maps rasterizer
    // markøren, respekteres wrapper-clippet ikke altid → firkantet snapshot.
    const flat = (StyleSheet.flatten(style) || {}) as any;
    const radii = {
      borderRadius: flat.borderRadius,
      borderTopLeftRadius: flat.borderTopLeftRadius,
      borderTopRightRadius: flat.borderTopRightRadius,
      borderBottomLeftRadius: flat.borderBottomLeftRadius,
      borderBottomRightRadius: flat.borderBottomRightRadius,
    };
    return (
      <View style={[style, { overflow: 'hidden' }]}>
        <LinearGradient {...gradientProps} style={[StyleSheet.absoluteFillObject, radii]} />
        {children}
      </View>
    );
  }
  return (
    <LinearGradient {...gradientProps} style={style}>
      {children}
    </LinearGradient>
  );
};

export default GradientView;
