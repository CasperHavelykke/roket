import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  Image,
  Alert,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { launchImageLibrary } from 'react-native-image-picker';

interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageURL?: string;
  timestamp: any;
}

function getOrCreateChatId(uid1: string, uid2: string): string {
  // Deterministisk chat ID: altid samme uanset rækkefølge
  return [uid1, uid2].sort().join('_');
}

export default function ChatScreen({ route, navigation }: any) {
  const { otherUser } = route.params as {
    otherUser: { id: string; displayName: string };
  };

  const currentUser = auth().currentUser!;
  const chatId = getOrCreateChatId(currentUser.uid, otherUser.id);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingImage, setSendingImage] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Opret chat-dokument hvis det ikke findes
    const chatRef = firestore().collection('chats').doc(chatId);
    chatRef.set(
      {
        participants: [currentUser.uid, otherUser.id],
        createdAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Lyt til beskeder real-time
    const unsubscribe = firestore()
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .onSnapshot(snapshot => {
        const msgs: Message[] = snapshot.docs.map(doc => ({
          id: doc.id,
          senderId: doc.data().senderId,
          text: doc.data().text,
          imageURL: doc.data().imageURL,
          timestamp: doc.data().timestamp,
        }));
        setMessages(msgs);
        setLoading(false);
      });

    return () => unsubscribe();
  }, [chatId]);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;

    setInputText('');

    const chatRef = firestore().collection('chats').doc(chatId);
    const messageRef = chatRef.collection('messages').doc();

    await messageRef.set({
      senderId: currentUser.uid,
      text,
      timestamp: firestore.FieldValue.serverTimestamp(),
    });

    await chatRef.set(
      {
        lastMessage: text,
        lastMessageTime: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleSendImage = () => {
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.8, maxWidth: 1080, maxHeight: 1080 },
      async response => {
        if (response.didCancel || response.errorCode) return;
        const uri = response.assets?.[0]?.uri;
        if (!uri) return;

        setSendingImage(true);
        try {
          const chatRef = firestore().collection('chats').doc(chatId);
          const messageRef = chatRef.collection('messages').doc();
          const ref = storage().ref(`chatImages/${chatId}/${messageRef.id}.jpg`);
          await ref.putFile(uri);
          const imageURL = await ref.getDownloadURL();

          await messageRef.set({
            senderId: currentUser.uid,
            imageURL,
            timestamp: firestore.FieldValue.serverTimestamp(),
          });

          await chatRef.set(
            {
              lastMessage: '📷 Foto',
              lastMessageTime: firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } catch (error: any) {
          Alert.alert('Fejl', error.message);
        } finally {
          setSendingImage(false);
        }
      }
    );
  };

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === currentUser.uid;
    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowThem]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem, item.imageURL && styles.bubbleImage]}>
          {item.imageURL ? (
            <Image source={{ uri: item.imageURL }} style={styles.chatImage} resizeMode="cover" />
          ) : (
            <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextThem]}>
              {item.text}
            </Text>
          )}
          <Text style={[styles.timestamp, isMe ? styles.timestampMe : styles.timestampThem]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{otherUser.displayName}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Sig hej til {otherUser.displayName}! 👋</Text>
            </View>
          }
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.imageButton}
            onPress={handleSendImage}
            disabled={sendingImage}
          >
            {sendingImage ? (
              <ActivityIndicator size="small" color="#667eea" />
            ) : (
              <Text style={styles.imageButtonText}>📷</Text>
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Skriv en besked..."
            placeholderTextColor="#aaa"
            multiline
            maxLength={1000}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <Text style={styles.sendButtonText}>→</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  messageRow: {
    marginBottom: 8,
    flexDirection: 'row',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowThem: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMe: {
    backgroundColor: '#667eea',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextMe: {
    color: '#fff',
  },
  messageTextThem: {
    color: '#222',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  timestampMe: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  timestampThem: {
    color: '#aaa',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 120,
    color: '#222',
  },
  sendButton: {
    marginLeft: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  imageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  imageButtonText: {
    fontSize: 24,
  },
  bubbleImage: {
    padding: 4,
  },
  chatImage: {
    width: 200,
    height: 200,
    borderRadius: 14,
  },
});
