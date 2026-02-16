import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Assumindo que você tem loginGoogle e logout aqui
import { db } from '../config/firebase'; // Importar Firestore
import { doc, getDoc } from 'firebase/firestore';
import { ShieldCheck, ShieldAlert, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Login() {
    const { loginGoogle, user, logout, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [verificandoPermissao, setVerificandoPermissao] = useState(false);

    useEffect(() => {
        const verificarAcesso = async () => {
            if (user) {
                setVerificandoPermissao(true);
                try {
                    // 1. Busca o documento do usuário pelo email (chave primária)
                    const userRef = doc(db, "usuarios", user.email.toLowerCase());
                    const userSnap = await getDoc(userRef);

                    if (userSnap.exists()) {
                        // 2. SUCESSO: Usuário está na lista
                        const dadosUsuario = userSnap.data();

                        // Opcional: Se quiser salvar no localStorage para acesso rápido em outras telas
                        // localStorage.setItem('user_role', dadosUsuario.papel);

                        toast.success(`Bem-vindo, ${dadosUsuario.papel === 'admin' ? 'Coordenador/Secretário' : 'Irmão'}!`);
                        navigate('/'); // Redireciona para Dashboard
                    } else {
                        // 3. FALHA: Usuário logou no Google, mas não está no DB
                        await logout(); // Desloga do Firebase Auth
                        toast.error("Acesso Restrito. Seu email não está cadastrado.");
                    }
                } catch (error) {
                    console.error("Erro ao verificar permissão:", error);
                    toast.error("Erro de conexão. Tente novamente.");
                    await logout();
                } finally {
                    setVerificandoPermissao(false);
                }
            }
        };

        verificarAcesso();
    }, [user, navigate, logout]);

    const handleLogin = async () => {
        try {
            await loginGoogle();
            // A verificação acontecerá no useEffect assim que 'user' mudar
        } catch (error) {
            toast.error("Erro ao conectar com Google.");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center animate-in fade-in zoom-in duration-300">

                <div className="flex justify-center mb-6">
                    <div className="bg-blue-100 p-4 rounded-full">
                        {verificandoPermissao ? (
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        ) : (
                            <ShieldCheck size={48} className="text-blue-600" />
                        )}
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-gray-800 mb-2">Gestor S-21</h1>
                <p className="text-gray-500 mb-8">Acesso restrito à comissão e secretário.</p>

                {authLoading || verificandoPermissao ? (
                    <div className="flex flex-col items-center justify-center py-4 gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-gray-400">Verificando credenciais teocráticas...</span>
                    </div>
                ) : (
                    <button
                        onClick={handleLogin}
                        className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 px-4 rounded-xl transition shadow-sm group"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                        <span className="group-hover:text-blue-600 transition">Entrar com Google</span>
                    </button>
                )}

                <p className="text-xs text-gray-400 mt-8 border-t pt-4">
                    Se você é um ancião e não consegue acessar, contate o Secretário para adicionar seu e-mail na lista de permissões.
                </p>
            </div>
        </div>
    );
}