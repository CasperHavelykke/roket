import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

interface ChatPreview {
  chatId: string;
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageTime: any;
}

export default function ChatsListScreen({ navigation }: any) {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = auth().currentUser;

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection('chats')
      .where('participants', 'array-contains', currentUser.uid)
      .onSnapshot(async snapshot => {
        const chatPreviews: ChatPreview[] = [];

        for (const doc of snapshot.docs) {
          const data = doc.data();
          if (!data.lastMessage) continue; // Spring over tomme chats

          const otherUserId = data.participants.find(
            (id: string) => id !== currentUser.uid
          );
          if (!otherUserId) continue;

          // Hent den anden brugers navn
          const otherUserDoc = await firestore()
            .collection('users')
            .doc(otherUserId)
            .get();
          const otherUserName = otherUserDoc.data()?.displayName ?? 'Ukendt';

          chatPreviews.push({
            chatId: doc.id,
            otherUserId,
            otherUserName,
            lastMessage: data.lastMessage,
            lastMessageTime: data.lastMessageTime,
          });
        }

        // Sortér efter seneste besked client-side
        chatPreviews.sort((a, b) => {
          const timeA = a.lastMessageTime?.toDate?.()?.getTime() ?? 0;
          const timeB = b.lastMessageTime?.toDate?.()?.getTime() ?? 0;
          return timeB - timeA;
        });

        setChats(chatPreviews);
        setLoading(false);
      }, error => {
        console.error('Chats listener error:', error);
        setLoading(false);
      });

    return () => unsubscribe();
  }, []);

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  const renderChat = ({ item }: { item: ChatPreview }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() =>
        navigation.navigate('Chat', {
          otherUser: { id: item.otherUserId, displayName: item.otherUserName },
        })
      }
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.otherUserName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatTop}>
          <Text style={styles.chatName}>{item.otherUserName}</Text>
          <Text style={styles.chatTime}>{formatTime(item.lastMessageTime)}</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Beskeder</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Ingen samtaler endnu 💬</Text>
          <Text style={styles.emptySubtext}>Find nogen i nærheden og send en besked!</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={renderChat}
          keyExtractor={item => item.chatId}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 22,
    color: '#fff',
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
  },
  chatTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  chatTime: {
    fontSize: 12,
    color: '#aaa',
  },
  lastMessage: {
    fontSize: 14,
    color: '#888',
  },
});
