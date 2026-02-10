import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

interface RouteParams {
  user: {
    id: string;
    displayName: string;
    bio: string;
    photoURL: string | null;
    distance?: number;
    lastSeen?: number; // millisekunder siden epoch
  };
}

const formatLastSeen = (lastSeenMs?: number): string => {
  if (!lastSeenMs) return '';
  const diff = Date.now() - lastSeenMs;
  if (diff < 5 * 60 * 1000) return 'Online nu';
  if (diff < 60 * 60 * 1000) return `Sidst set ${Math.floor(diff / 60000)} min siden`;
  if (diff < 24 * 60 * 60 * 1000) return `Sidst set ${Math.floor(diff / 3600000)} timer siden`;
  return `Sidst set ${Math.floor(diff / 86400000)} dage siden`;
};

export default function ProfileViewScreen({ route, navigation }: any) {
  const { user } = route.params as RouteParams;
  const currentUser = auth().currentUser!;

  const handleBlockReport = () => {
    Alert.alert(user.displayName, undefined, [
      {
        text: `Bloker ${user.displayName}`,
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            `Bloker ${user.displayName}?`,
            `${user.displayName} vil ikke længere dukke op i din liste og kan ikke sende dig beskeder.`,
            [
              { text: 'Annuller', style: 'cancel' },
              {
                text: 'Bloker',
                style: 'destructive',
                onPress: async () => {
                  await firestore()
                    .collection('users')
                    .doc(currentUser.uid)
                    .update({
                      blockedUsers: firestore.FieldValue.arrayUnion(user.id),
                    });
                  navigation.goBack();
                },
              },
            ]
          ),
      },
      {
        text: `Rapporter ${user.displayName}`,
        onPress: () =>
          Alert.alert(
            `Rapporter ${user.displayName}?`,
            'Dit rapport sendes anonymt til vores moderation.',
            [
              { text: 'Annuller', style: 'cancel' },
              {
                text: 'Send rapport',
                onPress: async () => {
                  await firestore().collection('reports').add({
                    reporterId: currentUser.uid,
                    reportedUserId: user.id,
                    createdAt: firestore.FieldValue.serverTimestamp(),
                  });
                  Alert.alert('Tak', 'Din rapport er modtaget.');
                },
              },
            ]
          ),
      },
      { text: 'Annuller', style: 'cancel' },
    ]);
  };

  const formatDistance = (distance?: number): string => {
    if (!distance) return '';
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m away`;
    }
    return `${distance.toFixed(1)} km away`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleBlockReport} style={styles.moreButton}>
          <Text style={styles.moreButtonText}>⋮</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.photoContainer}>
          {user.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>
                {user.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.name}>{user.displayName}</Text>

          {user.lastSeen !== undefined && (
            <Text style={[
              styles.onlineStatus,
              Date.now() - user.lastSeen < 5 * 60 * 1000 ? styles.onlineStatusActive : styles.onlineStatusInactive,
            ]}>
              {Date.now() - user.lastSeen < 5 * 60 * 1000 ? '● ' : '○ '}
              {formatLastSeen(user.lastSeen)}
            </Text>
          )}

          {user.distance !== undefined && (
            <Text style={styles.distance}>📍 {formatDistance(user.distance)}</Text>
          )}

          {user.bio ? (
            <View style={styles.bioContainer}>
              <Text style={styles.bioLabel}>About</Text>
              <Text style={styles.bio}>{user.bio}</Text>
            </View>
          ) : (
            <View style={styles.bioContainer}>
              <Text style={styles.bioEmpty}>No bio yet.</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.messageButton}
          onPress={() =>
            navigation.navigate('Chat', {
              otherUser: { id: user.id, displayName: user.displayName },
            })
          }
        >
          <Text style={styles.messageButtonText}>Send Message 💬</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 0,
  },
  backButtonText: {
    fontSize: 16,
    color: '#667eea',
    fontWeight: '600',
  },
  moreButton: {
    padding: 4,
  },
  moreButtonText: {
    fontSize: 26,
    color: '#999',
    lineHeight: 28,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  photoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  photo: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  photoPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 64,
    color: '#fff',
    fontWeight: 'bold',
  },
  infoContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 6,
  },
  onlineStatus: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  onlineStatusActive: {
    color: '#22c55e',
  },
  onlineStatusInactive: {
    color: '#999',
  },
  distance: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
    marginBottom: 20,
  },
  bioLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  bioContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
  },
  bio: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
  },
  bioEmpty: {
    fontSize: 15,
    color: '#bbb',
    fontStyle: 'italic',
  },
  messageButton: {
    backgroundColor: '#667eea',
    marginHorizontal: 20,
    marginTop: 24,
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
