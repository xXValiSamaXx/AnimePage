export const initJQueryExtensions = () => {
    // jQuery Animation Extensions
    $.fn.animateCard = function(options = {}) {
        const defaults = {
            duration: 400,
            scale: 1.05,
            shadow: '0 10px 20px rgba(0,0,0,0.2)',
            easing: 'easeOutQuad'
        };
        const settings = $.extend({}, defaults, options);

        return this.each(function() {
            const $card = $(this);
            const originalShadow = $card.css('box-shadow');
            const originalTransform = $card.css('transform');

            $card.css({
                transition: `all ${settings.duration}ms ${settings.easing}`,
                transform: `scale(${settings.scale})`,
                boxShadow: settings.shadow
            });

            setTimeout(() => {
                $card.css({
                    transform: originalTransform,
                    boxShadow: originalShadow
                });
            }, settings.duration);
        });
    };

    // jQuery CSS Extensions
    $.fn.enhanceTheme = function() {
        return this.each(function() {
            const $element = $(this);
            const isDark = $('html').hasClass('dark');
            
            if (isDark) {
                $element.find('.ui-slider').addClass('dark-mode');
                $element.find('.score-range').addClass('dark-mode');
            }
        });
    };

    // jQuery Clone Extensions
    $.fn.cloneWithEffect = function(options = {}) {
        const defaults = {
            duration: 300,
            offset: 50,
            opacity: 0
        };
        const settings = $.extend({}, defaults, options);

        return this.each(function() {
            const $original = $(this);
            const $clone = $original.clone(true);
            
            $clone.css({
                position: 'absolute',
                top: $original.offset().top,
                left: $original.offset().left,
                width: $original.width(),
                height: $original.height(),
                opacity: 1,
                zIndex: 1000
            }).appendTo('body');

            $clone.animate({
                top: `+=${settings.offset}`,
                opacity: settings.opacity
            }, settings.duration, function() {
                $(this).remove();
            });
        });
    };

    // Enhanced Tooltip
    if (!$.fn.enhancedTooltip) {
        $.widget("custom.enhancedTooltip", {
            options: {
                position: {
                    my: "center bottom-20",
                    at: "center top"
                },
                show: {
                    effect: "fadeIn",
                    duration: 200
                },
                hide: {
                    effect: "fadeOut",
                    duration: 200
                },
                content: null,
                classes: {
                    "ui-tooltip": "custom-tooltip dark:bg-gray-800 dark:text-white dark:border-gray-600"
                }
            },

            _create() {
                this._super();
                this._bindEvents();
            },

            _bindEvents() {
                this._on({
                    mouseover: "show",
                    mouseout: "hide",
                    focusin: "show",
                    focusout: "hide"
                });
            },

            show(event) {
                const content = this.options.content || this.element.attr("title");
                if (!content) return;

                this.tooltip = $("<div>")
                    .addClass(this.options.classes["ui-tooltip"])
                    .html(content)
                    .appendTo("body");

                this._position(event);
                this.tooltip.fadeIn(this.options.show.duration);
            },

            hide() {
                if (this.tooltip) {
                    this.tooltip.fadeOut(this.options.hide.duration, () => {
                        this.tooltip.remove();
                    });
                }
            },

            _position(event) {
                if (!this.tooltip) return;
                const position = $.extend({}, this.options.position, {
                    of: event.target
                });
                this.tooltip.position(position);
            },

            destroy() {
                this.hide();
                this._super();
            }
        });
    }
};

// Función para aplicar las extensiones
export const applyJQueryExtensions = () => {
    // Mejorar las tarjetas de anime
    $('.anime-card').hover(
        function() { $(this).animateCard(); },
        function() { $(this).animateCard({ scale: 1 }); }
    );

    // Mejorar tooltips
    $('[data-tooltip]').enhancedTooltip({
        content: function() {
            return $(this).attr('data-tooltip');
        }
    });

    // Aplicar efectos a botones de favoritos
    $('.favorite-btn').on('click', function() {
        $(this).cloneWithEffect({
            offset: -30,
            duration: 500
        });
    });

    // Mejorar sliders y temas
    $('#scoreSlider').parent().enhanceTheme();
};

// Export default object
export default {
    initJQueryExtensions,
    applyJQueryExtensions
};