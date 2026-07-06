import React, { useState } from 'react';
import { loginEditor, storeEditorSession, type EditorSession } from '../services/authApi';

interface EditorLoginModalProps {
  onClose: () => void;
  onLoginSuccess: (session: EditorSession | null) => void;
  isAuthenticated?: boolean;
}

export const EditorLoginModal: React.FC<EditorLoginModalProps> = ({ onClose, onLoginSuccess, isAuthenticated }) => {
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // Basic frontend format checks before hitting the network
    const trimmedToken = tokenInput.trim();

    if (!trimmedToken) {
      setError('O token não pode estar vazio.');
      return;
    }

    if (!trimmedToken.startsWith('vl_edit_')) {
      setError('Token inválido. O formato esperado não foi reconhecido.');
      return;
    }

    const maliciousPattern = /[<>{}"'`]/;
    if (maliciousPattern.test(trimmedToken)) {
      setError('Token contém caracteres inválidos.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const session = await loginEditor(trimmedToken);
      storeEditorSession(session);
      setSuccess(true);
      setTimeout(() => {
        onLoginSuccess(session);
        onClose();
      }, 800);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) setError('Token inválido ou não reconhecido.');
      else if (status === 429) setError('Muitas tentativas. Aguarde um minuto e tente novamente.');
      else setError('Não foi possível autenticar agora. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    storeEditorSession(null);
    onLoginSuccess(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 font-mono">
      <div className="w-[400px] bg-[#ece9d8] border-[3px] border-[#0058e6] rounded-t-lg shadow-2xl">
        <div className="winxp-gradient-blue text-white px-3 py-1.5 flex justify-between items-center rounded-t-md border-b-2 border-[#002fa7] select-none font-bold text-sm">
          <span className="flex items-center gap-2">
            <span>🔑 Acesso Restrito (Editor)</span>
          </span>
          <button 
            onClick={onClose}
            className="w-[21px] h-[21px] rounded bg-[#cc3300] border border-white flex items-center justify-center font-bold text-xs hover:bg-red-500 cursor-pointer focus:outline-none"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 text-xs">
          {isAuthenticated ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-4xl">🛡️</div>
              <p className="text-center font-bold text-[#0058e6]">Você está autenticado como Editor.</p>
              <p className="text-center text-gray-600">Com grandes poderes vêm grandes responsabilidades. Curar os melhores acordes ajuda toda a comunidade.</p>
              
              <button
                onClick={handleLogout}
                className="mt-2 w-full py-2 bg-[#cc3300] text-white border border-white font-bold hover:bg-red-600 cursor-pointer"
              >
                Desconectar (Sair)
              </button>
            </div>
          ) : (
            <>
              <p className="text-gray-700 leading-relaxed text-justify">
                Este sistema é restrito para curadores oficiais do Viola Libre. Insira o seu Token de Acesso pessoal abaixo para autenticar.
              </p>
              
              <div className="flex flex-col gap-1">
                <label className="font-bold text-gray-800">Token de Editor:</label>
                <input 
                  type="password"
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value);
                    setError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="vl_edit_..."
                  className="w-full bg-white border-2 border-r-white border-bottom-white border-[#808080] p-2 shadow-inner focus:outline-none focus:border-[#0058e6]"
                />
              </div>

              {error && (
                <div className="bg-[#ffdddd] border border-[#cc3300] text-[#cc3300] p-2 font-bold text-center">
                  ⚠️ {error}
                </div>
              )}

              {success && (
                <div className="bg-[#ddffdd] border border-[#228b22] text-[#1a6b1a] p-2 font-bold text-center">
                  ✔️ Autenticado com sucesso!
                </div>
              )}

              <div className="flex justify-end mt-2 pt-4 border-t border-[#808080]/30 gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] font-bold text-xs hover:bg-white cursor-pointer text-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleLogin}
                  disabled={success || loading}
                  className="px-4 py-1.5 bg-[#0058e6] text-white border border-[#002fa7] active:border-t-[#002fa7] active:border-l-[#002fa7] font-bold text-xs hover:bg-[#3a8bfb] cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Autenticando...' : 'Autenticar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
