import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import GradientView from '../components/GradientView';
import { useTheme } from '../theme';
import RoketLogo from '../assets/roket-logo-2.svg';
import RoketIndicator from '../assets/roket-logo-simpel.svg';
import MessagesIcon from '../assets/messages.svg';
import PinMapIconWhite from '../assets/pin-map-white.svg';
import ProfileIcon from '../assets/profile.svg';

interface Page {
  key: string;
  icon: 'logo' | 'messages' | 'distance' | 'guidelines';
  titleKey: 'welcomeTitle' | 'welcomeFeatureTitle' | 'welcomeDistanceTitle' | 'welcomeGuidelinesTitle';
  descKey: 'welcomeSubtitle' | 'welcomeFeatureDesc' | 'welcomeDistanceDesc' | 'welcomeGuidelinesDesc';
}

const pages: Page[] = [
  { key: '1', icon: 'logo', titleKey: 'welcomeTitle', descKey: 'welcomeSubtitle' },
  { key: '2', icon: 'messages', titleKey: 'welcomeFeatureTitle', descKey: 'welcomeFeatureDesc' },
  { key: '3', icon: 'distance', titleKey: 'welcomeDistanceTitle', descKey: 'welcomeDistanceDesc' },
  { key: '4', icon: 'guidelines', titleKey: 'welcomeGuidelinesTitle', descKey: 'welcomeGuidelinesDesc' },
];

export default function WelcomeScreen({ navigation }: any) {
  const { colors, t } = useTheme();
  const { width } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const goToSetup = () => navigation.replace('ProfileSetup');

  const goNext = () => {
    if (currentIndex < pages.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      goToSetup();
    }
  };

  const renderIcon = (icon: Page['icon']) => {
    const circle = (children: React.ReactNode) => (
      <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
        {children}
      </View>
    );
    switch (icon) {
      case 'logo':
        return <RoketLogo width={100} height={100} fill="#fff" />;
      case 'messages':
        return circle(<MessagesIcon width={48} height={48} stroke="#fff" />);
      case 'distance':
        return circle(<PinMapIconWhite width={48} height={48} />);
      case 'guidelines':
        return circle(<ProfileIcon width={48} height={48} stroke="#fff" />);
    }
  };

  const renderPage = ({ item }: { item: Page }) => (
    <View style={[styles.page, { width }]}>
      <View style={styles.iconContainer}>
        {renderIcon(item.icon)}
      </View>
      <Text style={styles.pageTitle}>{t[item.titleKey]}</Text>
      <Text style={styles.pageDesc}>{t[item.descKey]}</Text>
    </View>
  );

  const isLast = currentIndex === pages.length - 1;

  return (
    <GradientView
      colors={[colors.primaryBlue, colors.primaryRed]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <FlatList
        ref={flatListRef}
        data={pages}
        renderItem={renderPage}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.key}
        onMomentumScrollEnd={e => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {pages.map((_, i) => (
            <RoketIndicator
              key={i}
              width={i === currentIndex ? 16 : 12}
              height={i === currentIndex ? 16 : 12}
              fillRule="evenodd"
              fill="#fff"
              style={{ opacity: i === currentIndex ? 1 : 0.5, transform: [{ rotate: '90deg' }] }}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.primaryBlue }]}
          onPress={goNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {isLast ? t.welcomeGetStarted : t.welcomeNext}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goToSetup}
          style={[styles.skipButton, isLast && { opacity: 0 }]}
          disabled={isLast}
        >
          <Text style={styles.skipText}>{t.welcomeSkip}</Text>
        </TouchableOpacity>
      </View>
    </GradientView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 14,
  },
  pageDesc: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 30,
    paddingBottom: 50,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  nextButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    paddingVertical: 16,
    alignItems: 'center',
  },
nextButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  skipButton: {
    marginTop: 16,
    padding: 8,
  },
  skipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
  },
});
