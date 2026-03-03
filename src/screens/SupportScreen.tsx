import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientView from '../components/GradientView';
import { useTheme } from '../theme';
import RoketLogo from '../assets/roket-logo-simpel.svg';
import SupportIcon from '../assets/support.svg';
import { RewardedAd, RewardedAdEventType, AdEventType, TestIds } from 'react-native-google-mobile-ads';

const REWARDED_AD_ID = __DEV__
  ? TestIds.REWARDED
  : (Platform.select({
      android: 'ca-app-pub-3274880494665608/2491916759',
      ios: 'ca-app-pub-3274880494665608/5022565538',
    }) as string);

export default function SupportScreen({ navigation }: any) {
  const { colors, t } = useTheme();
  const insets = useSafeAreaInsets();
  const [adLoaded, setAdLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const rewardedAdRef = React.useRef<RewardedAd | null>(null);

  useEffect(() => {
    const ad = RewardedAd.createForAdRequest(REWARDED_AD_ID);
    rewardedAdRef.current = ad;

    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setAdLoaded(true);
      setLoading(false);
    });
    const unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      Alert.alert(t.supportThanks, t.supportThanksSub);
    });
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      setAdLoaded(false);
      setLoading(true);
      // Reload for next watch
      const nextAd = RewardedAd.createForAdRequest(REWARDED_AD_ID);
      rewardedAdRef.current = nextAd;
      nextAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        setAdLoaded(true);
        setLoading(false);
      });
      nextAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        Alert.alert(t.supportThanks, t.supportThanksSub);
      });
      nextAd.addAdEventListener(AdEventType.ERROR, () => {
        setLoading(false);
      });
      nextAd.load();
    });
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      console.warn('Rewarded ad error:', error);
      setLoading(false);
    });

    ad.load();

    return () => {
      unsubLoaded();
      unsubEarned();
      unsubClosed();
      unsubError();
    };
  }, []);

  const handleWatchAd = () => {
    const ad = rewardedAdRef.current;
    if (adLoaded && ad) {
      ad.show();
    } else if (!loading) {
      setLoading(true);
      const newAd = RewardedAd.createForAdRequest(REWARDED_AD_ID);
      rewardedAdRef.current = newAd;
      newAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        setAdLoaded(true);
        setLoading(false);
      });
      newAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        Alert.alert(t.supportThanks, t.supportThanksSub);
      });
      newAd.addAdEventListener(AdEventType.ERROR, () => {
        setLoading(false);
      });
      newAd.load();
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientView
        colors={[colors.primaryBlue, colors.primaryRed]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.textWhite }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textWhite }]}>{t.supportTitle}</Text>
        <RoketLogo width={24} height={24} style={{ marginLeft: 'auto' }} />
      </GradientView>

      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          <View style={styles.cardContent}>
            <SupportIcon width={32} height={32} color={colors.textPrimary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t.supportWatchAd}</Text>
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{t.supportWatchAdDesc}</Text>
          </View>
          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.6 }]}
            onPress={handleWatchAd}
            disabled={loading}
            activeOpacity={0.8}
          >
            <GradientView
              colors={[colors.primaryBlue, colors.primaryRed]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>{adLoaded ? t.supportWatchAd : t.supportRetry}</Text>
              )}
            </GradientView>
          </TouchableOpacity>
          {!loading && !adLoaded && (
            <Text style={[styles.adNotReady, { color: colors.textSecondary }]}>{t.supportAdNotReady}</Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    padding: 20,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  cardDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 10,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  adNotReady: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
    marginHorizontal: 24,
  },
});
