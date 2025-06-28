// components/ConnectMenu.tsx
import {useIsLoggedIn, DynamicEmbeddedWidget, DynamicWidget} from "@dynamic-labs/sdk-react-core";

const ConnectMenu = () => {
    const isLoggedIn = useIsLoggedIn();

    return (
        <>
            {!isLoggedIn ? (
                <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
                    <div className="w-full max-w-md mx-auto">
                        <div className="bg-white rounded-3xl shadow-xl p-8 space-y-8">
                            <DynamicEmbeddedWidget />
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Mount the full widget once, always available */}
            <DynamicWidget />
        </>
    );
};

export default ConnectMenu;;
