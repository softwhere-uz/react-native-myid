import { NativeModule, requireNativeModule } from 'expo';

declare class MyIdModule extends NativeModule<{}> {
  setValueAsync(value: string): Promise<void>;
}

export default requireNativeModule<MyIdModule>('MyId');
