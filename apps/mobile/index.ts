import { registerRootComponent } from "expo";
import { LogBox } from "react-native";

if (!__DEV__) {
  LogBox.ignoreAllLogs(true);
} else {
  LogBox.ignoreLogs([
    "Non-serializable values were found in the navigation state",
    "ViewPropTypes will be removed",
  ]);
}

import App from "./App";

registerRootComponent(App);
