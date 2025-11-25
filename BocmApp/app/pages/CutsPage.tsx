import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
// import OptimizedFeedScreen from '../screens/OptimizedFeedScreen';

const CutsPage = () => {
  return (
    <View style={styles.container}>
      {/* TikTok-style feed commented out */}
      {/* <OptimizedFeedScreen /> */}
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Cuts page disabled</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: 'white',
    fontSize: 16,
  },
});

export default CutsPage; 