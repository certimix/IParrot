package app.iparrot.messenger;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin local que liga o núcleo P2P (Go) à interface.
        registerPlugin(IParrotCorePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
