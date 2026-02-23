import React, { useState, useCallback } from 'react';
import { View, Image, ScrollView, TouchableOpacity, StyleSheet, NativeScrollEvent, NativeSyntheticEvent, ImageSourcePropType, LayoutChangeEvent } from 'react-native';

interface CardCarouselProps {
  photos: string[];
  width: number;
  fallbackSource: ImageSourcePropType;
  compact?: boolean;
  onPress?: () => void;
}

export default React.memo(function CardCarousel({ photos, width, fallbackSource, compact, onPress }: CardCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [height, setHeight] = useState(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setHeight(e.nativeEvent.layout.height);
  }, []);

  const onMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  }, [width]);

  if (photos.length === 0) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.container}>
        <Image source={fallbackSource} style={styles.image} />
      </TouchableOpacity>
    );
  }

  if (photos.length === 1) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.container}>
        <Image source={{ uri: photos[0] }} style={styles.image} resizeMode="cover" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container} onLayout={onLayout}>
      {height > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          bounces={false}
          nestedScrollEnabled
        >
          {photos.map((uri, i) => (
            <TouchableOpacity key={i} activeOpacity={0.85} onPress={onPress}>
              <Image source={{ uri }} style={{ width, height }} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {!compact && (
        <View style={styles.dots} pointerEvents="none">
          {photos.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  dots: {
    position: 'absolute',
    bottom: 52,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    backgroundColor: '#fff',
  },
});
