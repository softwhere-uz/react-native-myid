import { registerWebModule, NativeModule } from 'expo';

// MyIdModule is not available on the web platform.
class MyIdModule extends NativeModule<{}> {}

export default registerWebModule(MyIdModule, 'MyIdModule');
