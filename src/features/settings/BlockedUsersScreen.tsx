import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../../components/GradientView';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../theme';

interface BlockedUser {
  id: string;
  name: string;
}

export default function BlockedUsersScreen({ navigation }: any) {
  const { colors, t } = useTheme();
  const insets = useSafeAreaInsets();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUser = auth().currentUser;

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = firestore()
      .collection('users')
      .doc(currentUser.uid)
      .onSnapshot(async doc => {
        const blockedIds: string[] = doc.data()?.blockedUsers ?? [];
        if (blockedIds.length === 0) {
          setBlockedUsers([]);
          setLoading(false);
          return;
        }
        const users = await Promise.all(
          blockedIds.map(async id => {
            const userDoc = await firestore().collection('users').doc(id).get();
            return { id, name: userDoc.data()?.displayName ?? t.blockedDeletedUser };
          }),
        );
        setBlockedUsers(users);
        setLoading(false);
      });
    return () => unsubscribe();
  }, [currentUser?.uid]);

  const handleUnblock = (userId: string, name: string) => {
    if (!currentUser) return;
    Alert.alert(t.blockedUnblock, t.blockedUnblockConfirm(name), [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.blockedUnblock,
        onPress: async () => {
          await firestore()
            .collection('users')
            .doc(currentUser.uid)
            .update({
              blockedUsers: firestore.FieldValue.arrayRemove(userId),
            });
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: BlockedUser }) => (
    <View style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
      <View style={[styles.avatar, { backgroundColor: colors.primaryBlue }]}>
        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
        {item.name}
      </Text>
      <TouchableOpacity
        style={[styles.unblockButton, { borderColor: colors.primaryBlueText }]}
        onPress={() => handleUnblock(item.id, item.name)}
      >
        <Text style={[styles.unblockText, { color: colors.primaryBlueText }]}>{t.remove}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientView
        colors={[colors.primaryBlue, colors.primaryRed]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.textWhite }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textWhite }]}>{t.blockedTitle}</Text>
      </GradientView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primaryRed} />
        </View>
      ) : blockedUsers.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t.blockedEmpty}
          </Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: 16 + insets.bottom }]}
        />
      )}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  list: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  unblockButton: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  unblockText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
