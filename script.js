/**
 * Kamil Galeev Final Form
 * Лента постов: создание, лайки (toggle), комментарии с ником и эмодзи, фото
 * Данные хранятся в Supabase
 */

// Инициализация Supabase
// ⚠️ ЗАМЕНИТЕ ЭТИ ЗНАЧЕНИЯ НА ВАШИ ИЗ ПРОЕКТА SUPABASE ⚠️
const SUPABASE_URL = 'https://pegapsojgtjiugsetadx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlZ2Fwc29qZ3RqaXVnc2V0YWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTYxODYsImV4cCI6MjA5Mjg5MjE4Nn0.Ybv1SvevZz-D4WkAdzJpQ2EdneqKjhbmxckKIYKlzys';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(function() {
    // --- Состояние приложения ---
    let posts = [];
    let currentPostIdForComment = null;
    let currentImageData = null;
    let isLoading = false;

    // Хранилище ID постов, которые лайкнул текущий пользователь (из localStorage)
    let likedPosts = new Set();

    // Сохраняем последний использованный ник (для удобства)
    let lastUsedNickname = localStorage.getItem('last_comment_nickname') || '';

    // --- DOM элементы ---
    const postsContainer = document.getElementById('postsContainer');
    const postContentInput = document.getElementById('postContentInput');
    const submitPostBtn = document.getElementById('submitPostBtn');
    const commentModal = document.getElementById('commentModal');
    const commentInput = document.getElementById('commentInput');
    const commentNickname = document.getElementById('commentNickname');
    const submitCommentBtn = document.getElementById('submitCommentBtn');
    const cancelCommentBtn = document.getElementById('cancelCommentBtn');
    const closeModalSpan = document.querySelector('.close-modal');
    const quickEmojis = document.querySelectorAll('.quick-emoji');
    
    // элементы для фото
    const imageInput = document.getElementById('imageInput');
    const attachImageBtn = document.getElementById('attachImageBtn');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const removeImageBtn = document.getElementById('removeImageBtn');

    // --- Функции работы с Supabase ---

    // Загрузка постов из Supabase
    async function loadPostsFromSupabase() {
        if (isLoading) return;
        isLoading = true;
        
        try {
            // Показываем индикатор загрузки
            postsContainer.innerHTML = '<div class="empty-feed">⏳ загрузка постов...</div>';
            
            // Загружаем посты с сортировкой по дате (новые сверху)
            const { data: postsData, error: postsError } = await supabase
                .from('posts')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (postsError) throw postsError;
            
            // Загружаем комментарии для всех постов
            const { data: commentsData, error: commentsError } = await supabase
                .from('comments')
                .select('*')
                .order('created_at', { ascending: true });
            
            if (commentsError) throw commentsError;
            
            // Группируем комментарии по post_id
            const commentsByPost = {};
            if (commentsData) {
                commentsData.forEach(comment => {
                    if (!commentsByPost[comment.post_id]) {
                        commentsByPost[comment.post_id] = [];
                    }
                    commentsByPost[comment.post_id].push(comment);
                });
            }
            
            // Формируем посты с комментариями
            posts = (postsData || []).map(post => ({
                id: post.id,
                content: post.content || '',
                likes: post.likes || 0,
                date: new Date(post.created_at).toLocaleString(),
                imageData: post.image_data,
                comments: (commentsByPost[post.id] || []).map(comment => ({
                    id: comment.id,
                    text: comment.content,
                    nickname: comment.nickname,
                    date: new Date(comment.created_at).toLocaleString()
                }))
            }));
            
            renderFeed();
            
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            postsContainer.innerHTML = '<div class="empty-feed">❌ ошибка загрузки. обнови страницу</div>';
        } finally {
            isLoading = false;
        }
    }

    // Создание нового поста
    async function createNewPost() {
        const content = postContentInput.value.trim();
        if (content === "" && !currentImageData) {
            alert("Нельзя отправить пустой пост ✧ добавь текст или фото");
            return;
        }
        
        // Показываем индикатор сохранения
        const originalBtnText = submitPostBtn.textContent;
        submitPostBtn.textContent = '⏳ сохраняем...';
        submitPostBtn.disabled = true;
        
        try {
            const newPost = {
                content: content || "",
                likes: 0,
                image_data: currentImageData || null,
                created_at: new Date().toISOString()
            };
            
            const { data, error } = await supabase
                .from('posts')
                .insert([newPost])
                .select()
                .single();
            
            if (error) throw error;
            
            // Очищаем форму
            postContentInput.value = '';
            currentImageData = null;
            imagePreviewContainer.style.display = 'none';
            imagePreview.src = '';
            
            // Перезагружаем ленту
            await loadPostsFromSupabase();
            
        } catch (error) {
            console.error('Ошибка создания поста:', error);
            alert('❌ не удалось создать пост. попробуй еще раз');
        } finally {
            submitPostBtn.textContent = originalBtnText;
            submitPostBtn.disabled = false;
        }
    }

    // Добавление комментария
    async function addCommentToCurrentPost() {
        if (currentPostIdForComment === null) return;
        
        const commentText = commentInput.value.trim();
        if (commentText === "") {
            alert("Напиши комментарий ❤️");
            return;
        }
        
        let nickname = commentNickname ? commentNickname.value.trim() : '';
        if (nickname === "") {
            nickname = "Аноним";
        }
        
        // Показываем индикатор
        const originalBtnText = submitCommentBtn.textContent;
        submitCommentBtn.textContent = '⏳...';
        submitCommentBtn.disabled = true;
        
        try {
            const newComment = {
                post_id: currentPostIdForComment,
                content: commentText,
                nickname: nickname,
                created_at: new Date().toISOString()
            };
            
            const { error } = await supabase
                .from('comments')
                .insert([newComment]);
            
            if (error) throw error;
            
            // Сохраняем ник для следующих комментариев
            lastUsedNickname = nickname;
            localStorage.setItem('last_comment_nickname', nickname);
            
            // Перезагружаем ленту
            await loadPostsFromSupabase();
            closeModal();
            
        } catch (error) {
            console.error('Ошибка создания комментария:', error);
            alert('❌ не удалось добавить комментарий');
        } finally {
            submitCommentBtn.textContent = originalBtnText;
            submitCommentBtn.disabled = false;
        }
    }

    // Переключение лайка
    async function toggleLike(postId) {
        const post = posts.find(p => p.id === postId);
        if (!post) return;
        
        const isCurrentlyLiked = likedPosts.has(postId);
        const newLikesCount = isCurrentlyLiked 
            ? Math.max(0, (post.likes || 0) - 1)
            : (post.likes || 0) + 1;
        
        try {
            // Обновляем лайк в базе
            const { error } = await supabase
                .from('posts')
                .update({ likes: newLikesCount })
                .eq('id', postId);
            
            if (error) throw error;
            
            // Обновляем локальное состояние
            if (isCurrentlyLiked) {
                likedPosts.delete(postId);
            } else {
                likedPosts.add(postId);
            }
            
            // Сохраняем likedPosts в localStorage
            localStorage.setItem('kamil_liked_posts', JSON.stringify(Array.from(likedPosts)));
            
            // Обновляем локальный массив постов
            post.likes = newLikesCount;
            
            // Обновляем только счетчик лайков в UI без полного рендера
            const likeSpan = document.querySelector(`.like-btn[data-id="${postId}"] .like-count`);
            if (likeSpan) likeSpan.textContent = newLikesCount;
            
            const likeBtn = document.querySelector(`.like-btn[data-id="${postId}"]`);
            if (likeBtn) {
                if (!isCurrentlyLiked) {
                    likeBtn.classList.add('liked');
                    likeBtn.innerHTML = `❤️ <span class="like-count">${newLikesCount}</span>`;
                } else {
                    likeBtn.classList.remove('liked');
                    likeBtn.innerHTML = `🖤 <span class="like-count">${newLikesCount}</span>`;
                }
            }
            
        } catch (error) {
            console.error('Ошибка обновления лайка:', error);
        }
    }

    // --- UI функции ---
    
    // Рендер всей ленты
    function renderFeed() {
        if (!postsContainer) return;
        if (posts.length === 0) {
            postsContainer.innerHTML = `<div class="empty-feed">пока нет постов. создай первый ✨</div>`;
            return;
        }

        let html = '';
        posts.forEach(post => {
            const likeCount = post.likes || 0;
            const commentsArray = post.comments || [];
            const commentsCount = commentsArray.length;
            const isLiked = likedPosts.has(post.id);
            const likeButtonClass = isLiked ? 'like-btn liked' : 'like-btn';
            const likeIcon = isLiked ? '❤️' : '🖤';

            // Фото в посте, если есть
            let imageHtml = '';
            if (post.imageData) {
                imageHtml = `<div class="post-image">
                                <img src="${post.imageData}" alt="post image" loading="lazy">
                             </div>`;
            }

            // Генерация блока комментариев с никами
            let commentsHtml = '';
            if (commentsArray.length > 0) {
                commentsHtml = `<div class="comments-section">
                                    <div class="comments-title">💬 комментарии (${commentsCount})</div>`;
                commentsArray.forEach(comment => {
                    const nickname = comment.nickname || 'Аноним';
                    const commentText = comment.text || comment;
                    const commentDate = comment.date || '';
                    
                    commentsHtml += `
                        <div class="comment-item">
                            <div class="comment-header">
                                <span class="comment-author">${escapeHtml(nickname)}</span>
                                ${commentDate ? `<span class="comment-date">${escapeHtml(commentDate)}</span>` : ''}
                            </div>
                            <div class="comment-text">${escapeHtml(commentText)}</div>
                        </div>
                    `;
                });
                commentsHtml += `</div>`;
            } else {
                commentsHtml = `<div class="comments-section">
                                    <div class="comments-title">💬 комментарии (0)</div>
                                    <div class="empty-comments">нет комментариев. добавь эмодзи ⤴️</div>
                                </div>`;
            }

            html += `
                <div class="post-item" data-post-id="${post.id}">
                    <div class="post-header">
                        <span class="post-id">#${post.id}</span>
                        <span class="post-date">${escapeHtml(post.date) || 'недавно'}</span>
                    </div>
                    <div class="post-content">${escapeHtml(post.content)}</div>
                    ${imageHtml}
                    <div class="post-actions">
                        <button class="${likeButtonClass}" data-id="${post.id}">
                            ${likeIcon} <span class="like-count">${likeCount}</span>
                        </button>
                        <button class="comment-btn" data-id="${post.id}">
                            💬 ${commentsCount}
                        </button>
                    </div>
                    ${commentsHtml}
                </div>
            `;
        });
        postsContainer.innerHTML = html;

        // навесить обработчики на динамические кнопки
        document.querySelectorAll('.like-btn').forEach(btn => {
            btn.removeEventListener('click', handleLikeClick);
            btn.addEventListener('click', handleLikeClick);
        });
        document.querySelectorAll('.comment-btn').forEach(btn => {
            btn.removeEventListener('click', handleCommentClick);
            btn.addEventListener('click', handleCommentClick);
        });
    }

    // Обработчик лайков
    function handleLikeClick(e) {
        const btn = e.currentTarget;
        const postId = parseInt(btn.getAttribute('data-id'));
        toggleLike(postId);
    }

    // Открыть модалку для комментария
    function handleCommentClick(e) {
        const btn = e.currentTarget;
        const postId = parseInt(btn.getAttribute('data-id'));
        currentPostIdForComment = postId;
        commentInput.value = '';
        
        // Подставляем последний использованный ник
        if (commentNickname) {
            commentNickname.value = lastUsedNickname;
        }
        
        commentModal.style.display = 'flex';
        if (commentNickname) commentNickname.focus();
    }

    function closeModal() {
        commentModal.style.display = 'none';
        currentPostIdForComment = null;
        commentInput.value = '';
    }

    // Конвертация файла в base64
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // Обработка выбора фото
    attachImageBtn.addEventListener('click', () => {
        imageInput.click();
    });

    imageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            // Ограничим размер фото до 2MB
            if (file.size > 2 * 1024 * 1024) {
                alert('❌ фото太大了! максимальный размер 2MB');
                return;
            }
            try {
                currentImageData = await fileToBase64(file);
                imagePreview.src = currentImageData;
                imagePreviewContainer.style.display = 'inline-block';
            } catch (error) {
                console.error('Ошибка загрузки фото:', error);
            }
        }
        imageInput.value = '';
    });

    removeImageBtn.addEventListener('click', () => {
        currentImageData = null;
        imagePreviewContainer.style.display = 'none';
        imagePreview.src = '';
    });

    // Экранирование HTML
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // --- Инициализация событий ---
    function bindEvents() {
        submitPostBtn.addEventListener('click', createNewPost);
        submitCommentBtn.addEventListener('click', addCommentToCurrentPost);
        cancelCommentBtn.addEventListener('click', closeModal);
        closeModalSpan.addEventListener('click', closeModal);
        
        window.addEventListener('click', (e) => {
            if (e.target === commentModal) closeModal();
        });
        
        quickEmojis.forEach(emojiSpan => {
            emojiSpan.addEventListener('click', (e) => {
                const emoji = e.currentTarget.innerText;
                commentInput.value += emoji;
                commentInput.focus();
            });
        });
        
        commentInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                addCommentToCurrentPost();
            }
        });
        
        if (commentNickname) {
            commentNickname.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commentInput.focus();
                }
            });
        }
    }

    // --- Загрузка сохраненных лайков ---
    function loadLikedPosts() {
        const saved = localStorage.getItem('kamil_liked_posts');
        if (saved) {
            try {
                likedPosts = new Set(JSON.parse(saved));
            } catch(e) { console.warn(e); }
        }
    }

    // --- Старт приложения ---
    async function init() {
        loadLikedPosts();
        bindEvents();
        await loadPostsFromSupabase();
    }

    init();
})();